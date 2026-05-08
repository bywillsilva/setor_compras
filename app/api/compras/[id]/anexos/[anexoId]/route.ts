import { rm } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { deleteSupabaseAttachmentObject } from '@/lib/attachment-storage'
import { getRequestSession } from '@/lib/auth/api'
import { hasFeatureAccess } from '@/lib/auth/permissions'
import { parseSupabaseAttachmentUrl, resolveLocalAttachmentPath } from '@/lib/attachments'
import { deleteAnexo, getAnexoById, getCompraById } from '@/lib/repositories'

export const runtime = 'nodejs'

export async function DELETE(
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

    const session = await getRequestSession(request)
    if (!session || session.perfil !== 'admin') {
      return NextResponse.json({ error: 'A exclusao de anexos exige autorizacao administrativa.' }, { status: 403 })
    }

    const attachmentId = Number(anexoId)
    const anexo = await getAnexoById(compraId, attachmentId)

    if (!anexo) {
      return NextResponse.json({ error: 'Anexo nao encontrado.' }, { status: 404 })
    }

    await deleteAnexo(compraId, attachmentId)

    const supabaseObject = parseSupabaseAttachmentUrl(anexo.arquivo_url)

    if (supabaseObject) {
      await deleteSupabaseAttachmentObject(supabaseObject.bucket, supabaseObject.objectPath)
    } else {
      const attachmentPath = resolveLocalAttachmentPath(anexo.arquivo_url)
      if (attachmentPath) {
        await rm(attachmentPath, { force: true }).catch(() => undefined)
      }
    }

    return NextResponse.json({ message: 'Anexo excluido com sucesso.' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao excluir anexo.' },
      { status: 400 },
    )
  }
}

async function validateAttachmentAccess(request: NextRequest, compraId: number) {
  const session = await getRequestSession(request)

  if (!session) {
    return NextResponse.json({ error: 'Sessao expirada. Faca login novamente.' }, { status: 401 })
  }

  if (hasFeatureAccess(session.perfil, 'compras')) {
    return null
  }

  if (!hasFeatureAccess(session.perfil, 'solicitacoes')) {
    return NextResponse.json({ error: 'Voce nao tem permissao para esta acao.' }, { status: 403 })
  }

  const compra = await getCompraById(compraId)
  if (!compra || compra.solicitante_id !== session.userId) {
    return NextResponse.json({ error: 'Voce nao tem acesso a esta solicitacao.' }, { status: 403 })
  }

  return null
}
