import { mkdir, rm, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { requireFeature } from '@/lib/auth/api'
import { deleteSupabaseAttachmentObject, ensureSupabaseAttachmentBucket, uploadBufferToSupabaseAttachmentStorage } from '@/lib/attachment-storage'
import { SUPABASE_ATTACHMENT_BUCKET } from '@/lib/attachments'
import { getDatabaseType } from '@/lib/db'
import { createAnexo, deleteAnexo, listAnexosByCompraId } from '@/lib/repositories'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, 'compras')
    if ('response' in guard) {
      return guard.response
    }

    const { id } = await params
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
    const guard = await requireFeature(request, 'compras')
    if ('response' in guard) {
      return guard.response
    }

    const { id } = await params
    const compraId = Number(id)
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
