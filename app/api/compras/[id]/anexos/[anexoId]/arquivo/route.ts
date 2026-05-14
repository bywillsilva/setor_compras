import { readFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { uploadBufferToSupabaseAttachmentStorage } from '@/lib/attachment-storage'
import { getRequestSession } from '@/lib/auth/api'
import { hasFeatureAccess } from '@/lib/auth/permissions'
import {
  isExternalAttachmentUrl,
  parseSupabaseAttachmentUrl,
  resolveLocalAttachmentPath,
} from '@/lib/attachments'
import { getDatabaseType, getSupabaseClient } from '@/lib/db'
import { getAnexoById, getCompraById, updateAnexoArquivoUrl } from '@/lib/repositories'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; anexoId: string }> },
) {
  try {
    const { id, anexoId } = await params
    const compraId = Number(id)
    const accessError = await validateAttachmentAccess(request, compraId)
    if (accessError) {
      return accessError
    }
    const attachmentId = Number(anexoId)
    const anexo = await getAnexoById(compraId, attachmentId)

    if (!anexo) {
      return NextResponse.json({ error: 'Anexo nao encontrado.' }, { status: 404 })
    }

    if (isExternalAttachmentUrl(anexo.arquivo_url)) {
      return NextResponse.redirect(new URL(anexo.arquivo_url))
    }

    const supabaseObject = parseSupabaseAttachmentUrl(anexo.arquivo_url)

    if (supabaseObject) {
      const client = getSupabaseClient()

      if (!client) {
        return NextResponse.json(
          { error: 'Supabase nao configurado para abrir anexos.' },
          { status: 500 },
        )
      }

      const { data, error } = await client.storage.from(supabaseObject.bucket).download(supabaseObject.objectPath)

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || 'Arquivo do anexo nao foi encontrado no storage.' },
          { status: 404 },
        )
      }

      const arrayBuffer = await data.arrayBuffer()
      const contentType = data.type || getContentType(supabaseObject.objectPath)

      return new NextResponse(new Uint8Array(arrayBuffer), {
        status: 200,
        headers: {
          'content-type': contentType,
          'content-length': String(arrayBuffer.byteLength),
          'content-disposition': buildContentDispositionHeader(anexo.nome_arquivo),
          'cache-control': 'private, no-store, max-age=0',
          'x-content-type-options': 'nosniff',
        },
      })
    }

    const attachmentPath = resolveLocalAttachmentPath(anexo.arquivo_url)

    if (!attachmentPath) {
      return NextResponse.json({ error: 'Localizacao do anexo invalida.' }, { status: 400 })
    }

    const fileBuffer = await readFile(attachmentPath).catch(() => null)

    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'Arquivo do anexo nao foi encontrado no servidor.' },
        { status: 404 },
      )
    }

    if (getDatabaseType() === 'supabase') {
      const objectPath = `compras/${compraId}/${path.basename(attachmentPath)}`

      try {
        const migratedUrl = await uploadBufferToSupabaseAttachmentStorage(objectPath, fileBuffer)
        if (migratedUrl !== anexo.arquivo_url) {
          await updateAnexoArquivoUrl(compraId, attachmentId, migratedUrl)
        }
      } catch {
        // Se a migracao falhar, ainda entregamos o arquivo local para nao bloquear o usuario.
      }
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'content-type': getContentType(attachmentPath),
        'content-length': String(fileBuffer.byteLength),
        'content-disposition': buildContentDispositionHeader(anexo.nome_arquivo),
        'cache-control': 'private, no-store, max-age=0',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao abrir anexo.' },
      { status: 500 },
    )
  }
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

function buildContentDispositionHeader(fileName: string) {
  const sanitizedName = fileName.replace(/["\r\n]+/g, ' ').trim() || 'anexo'
  const encodedName = encodeURIComponent(sanitizedName)
  return `inline; filename="${sanitizedName}"; filename*=UTF-8''${encodedName}`
}

function getContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()

  switch (extension) {
    case '.pdf':
      return 'application/pdf'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    case '.txt':
      return 'text/plain; charset=utf-8'
    case '.csv':
      return 'text/csv; charset=utf-8'
    case '.xls':
      return 'application/vnd.ms-excel'
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case '.doc':
      return 'application/msword'
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    default:
      return 'application/octet-stream'
  }
}
