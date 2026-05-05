import { rm } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { deleteSupabaseAttachmentObject } from '@/lib/attachment-storage'
import { requireFeature } from '@/lib/auth/api'
import { parseSupabaseAttachmentUrl, resolveLocalAttachmentPath } from '@/lib/attachments'
import { deleteAnexo, getAnexoById } from '@/lib/repositories'

export const runtime = 'nodejs'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; anexoId: string }> },
) {
  try {
    const guard = await requireFeature(request, 'compras')
    if ('response' in guard) {
      return guard.response
    }

    const { id, anexoId } = await params
    const compraId = Number(id)
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
