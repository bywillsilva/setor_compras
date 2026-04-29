import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { createAnexo, listAnexosByCompraId } from '@/lib/repositories'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
    const { id } = await params
    const compraId = Number(id)
    const formData = await request.formData()
    const tipo = normalizeTipo(String(formData.get('tipo') ?? 'outro'))
    const files = formData.getAll('files').filter((item): item is File => item instanceof File)

    if (files.length === 0) {
      return NextResponse.json({ error: 'Selecione pelo menos um arquivo.' }, { status: 400 })
    }

    const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', 'compras', String(compraId))
    await mkdir(uploadDirectory, { recursive: true })

    const anexosCriados = []

    for (const [index, file] of files.entries()) {
      const sanitizedName = sanitizeFileName(file.name)
      const finalFileName = `${Date.now()}-${index}-${sanitizedName}`
      const buffer = Buffer.from(await file.arrayBuffer())
      const filePath = path.join(uploadDirectory, finalFileName)
      const publicPath = `/uploads/compras/${compraId}/${finalFileName}`

      await writeFile(filePath, buffer)

      const anexoId = await createAnexo({
        compra_id: compraId,
        tipo,
        arquivo_url: publicPath,
        nome_arquivo: file.name,
      })

      anexosCriados.push({
        id: anexoId,
        arquivo_url: publicPath,
        nome_arquivo: file.name,
        tipo,
      })
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
