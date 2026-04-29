import { rm } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { deleteAnexo, getAnexoById } from '@/lib/repositories'

export const runtime = 'nodejs'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; anexoId: string }> },
) {
  try {
    const { id, anexoId } = await params
    const compraId = Number(id)
    const attachmentId = Number(anexoId)
    const anexo = await getAnexoById(compraId, attachmentId)

    if (!anexo) {
      return NextResponse.json({ error: 'Anexo nao encontrado.' }, { status: 404 })
    }

    await deleteAnexo(compraId, attachmentId)

    const attachmentPath = resolveAttachmentPath(anexo.arquivo_url)

    if (attachmentPath) {
      await rm(attachmentPath, { force: true }).catch(() => undefined)
    }

    return NextResponse.json({ message: 'Anexo excluido com sucesso.' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao excluir anexo.' },
      { status: 400 },
    )
  }
}

function resolveAttachmentPath(arquivoUrl: string) {
  const relativePath = arquivoUrl.replace(/^\/+/, '')
  const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads')
  const attachmentPath = path.resolve(process.cwd(), 'public', relativePath)

  if (attachmentPath === uploadsRoot || attachmentPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return attachmentPath
  }

  return null
}
