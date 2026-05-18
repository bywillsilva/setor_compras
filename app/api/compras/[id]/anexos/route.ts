import { mkdir, rm, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/auth/api'
import { hasFeatureAccess } from '@/lib/auth/permissions'
import { deleteSupabaseAttachmentObject, ensureSupabaseAttachmentBucket, uploadBufferToSupabaseAttachmentStorage } from '@/lib/attachment-storage'
import { SUPABASE_ATTACHMENT_BUCKET } from '@/lib/attachments'
import { getDatabaseType } from '@/lib/db'
import { createAnexo, deleteAnexo, getCompraById, listAnexosByCompraId, notifyCompraFinanceDocumentsReady } from '@/lib/repositories'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const accessError = await validateAttachmentAccess(request, Number(id))
    if (accessError) {
      return accessError
    }

    const anexos = await listAnexosByCompraId(Number(id))
    return NextResponse.json(anexos)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar anexos.' },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const compraId = Number(id)
    const session = await getRequestSession(request)
    const accessError = await validateAttachmentAccess(request, compraId)
    if (accessError) {
      return accessError
    }

    const formData = await request.formData()
    const tipo = normalizeTipo(String(formData.get('tipo') ?? 'outro'))
    const files = formData.getAll('files').filter((item): item is File => item instanceof File)

    if (files.length === 0) {
      return NextResponse.json({ error: 'Selecione pelo menos um arquivo.' }, { status: 400 })
    }

    const anexosCriados = []
    const arquivosCriados: string[] = []
    const anexoIdsCriados: number[] = []
    const storageObjectsCriados: string[] = []
    const useSupabaseStorage = getDatabaseType() === 'supabase'
    const anexosAntes = await listAnexosByCompraId(compraId)
    const possuiaNotaFiscal = anexosAntes.some((anexo) => anexo.tipo === 'nf')
    const possuiaBoleto = anexosAntes.some((anexo) => anexo.tipo === 'boleto')

    if (!useSupabaseStorage) {
      const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', 'compras', String(compraId))
      await mkdir(uploadDirectory, { recursive: true })
    } else {
      await ensureSupabaseAttachmentBucket()
    }

    try {
      for (const [index, file] of files.entries()) {
        const sanitizedName = sanitizeFileName(file.name)
        const finalFileName = `${Date.now()}-${index}-${sanitizedName}`
        const buffer = Buffer.from(await file.arrayBuffer())
        let arquivoUrl: string

        if (useSupabaseStorage) {
          const objectPath = `compras/${compraId}/${finalFileName}`
          arquivoUrl = await uploadBufferToSupabaseAttachmentStorage(objectPath, buffer, file.type)
          storageObjectsCriados.push(objectPath)
        } else {
          const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', 'compras', String(compraId))
          const filePath = path.join(uploadDirectory, finalFileName)
          const publicPath = `/uploads/compras/${compraId}/${finalFileName}`

          await writeFile(filePath, buffer)
          arquivosCriados.push(filePath)
          arquivoUrl = publicPath
        }

        const anexoId = await createAnexo({
          compra_id: compraId,
          tipo,
          arquivo_url: arquivoUrl,
          nome_arquivo: file.name,
        })

        anexoIdsCriados.push(anexoId)
        anexosCriados.push({
          id: anexoId,
          arquivo_url: arquivoUrl,
          nome_arquivo: file.name,
          tipo,
        })
      }
    } catch (error) {
      await Promise.all(anexoIdsCriados.map((anexoId) => deleteAnexo(compraId, anexoId).catch(() => undefined)))
      await Promise.all(arquivosCriados.map((filePath) => rm(filePath, { force: true }).catch(() => undefined)))
      await deleteSupabaseObjects(storageObjectsCriados)
      throw error
    }

    const possuiNotaFiscalAgora = possuiaNotaFiscal || tipo === 'nf'
    const possuiBoletoAgora = possuiaBoleto || tipo === 'boleto'
    const ganhouKitFinanceiro =
      !(possuiaNotaFiscal && possuiaBoleto) &&
      possuiNotaFiscalAgora &&
      possuiBoletoAgora

    if (ganhouKitFinanceiro) {
      await notifyCompraFinanceDocumentsReady(compraId, { excludeUserIds: session ? [session.userId] : [] })
    }

    return NextResponse.json({
      message: 'Anexos enviados com sucesso.',
      anexos: anexosCriados,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao enviar anexos.' },
      { status: 500 },
    )
  }
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-')
}

function normalizeTipo(value: string) {
  if (value === 'cotacao' || value === 'nf' || value === 'boleto') {
    return value
  }

  return 'outro'
}

async function deleteSupabaseObjects(objectPaths: string[]) {
  if (objectPaths.length === 0) {
    return
  }

  await Promise.all(objectPaths.map((objectPath) => deleteSupabaseAttachmentObject(SUPABASE_ATTACHMENT_BUCKET, objectPath)))
}

async function validateAttachmentAccess(request: NextRequest, compraId: number) {
  const session = await getRequestSession(request)

  if (!session) {
    return NextResponse.json({ error: 'Sessao expirada. Faca login novamente.' }, { status: 401 })
  }

  if (session.perfil === 'admin' || hasFeatureAccess(session.perfil, 'compras', session.features)) {
    return null
  }

  if (!hasFeatureAccess(session.perfil, 'solicitacoes', session.features)) {
    return NextResponse.json({ error: 'Voce nao tem permissao para esta acao.' }, { status: 403 })
  }

  const compra = await getCompraById(compraId)
  const canViewAsRequester =
    compra &&
    (compra.solicitante_id === session.userId ||
      (!compra.solicitante_id && compra.solicitado_por?.trim() === session.nome.trim()))

  if (!canViewAsRequester) {
    return NextResponse.json({ error: 'Voce nao tem acesso a esta solicitacao.' }, { status: 403 })
  }

  return null
}
