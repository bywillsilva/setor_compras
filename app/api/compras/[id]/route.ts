import { rm } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { getCompraDetail, permanentlyDeleteCompra, setCompraArchivedState, updateCompra } from '@/lib/repositories'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const compra = await getCompraDetail(Number(id))

    if (!compra) {
      return NextResponse.json({ error: 'Compra nao encontrada.' }, { status: 404 })
    }

    return NextResponse.json(compra)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar compra.' },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (typeof body.arquivado === 'boolean') {
      const result = await setCompraArchivedState(Number(id), body.arquivado)
      return NextResponse.json({
        message: result.archived ? 'Pedido arquivado com sucesso.' : 'Pedido desarquivado com sucesso.',
        archived: result.archived,
      })
    }

    await updateCompra(Number(id), {
      categoria: body.categoria,
      fornecedor: body.fornecedor,
      descricao: body.descricao,
      valor_total: body.valor_total,
      numero_pedido: body.numero_pedido,
      status: body.status,
      status_entrega: body.status_entrega,
      previsao_entrega: body.previsao_entrega,
      data_envio_fornecedor: body.data_envio_fornecedor,
      data_entrega_real: body.data_entrega_real,
    })

    return NextResponse.json({ message: 'Compra atualizada com sucesso.' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar compra.' },
      { status: 400 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await permanentlyDeleteCompra(Number(id))

    const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', 'compras', id)
    await rm(uploadDirectory, { recursive: true, force: true })

    return NextResponse.json({ message: 'Pedido excluido com sucesso.' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao excluir compra.' },
      { status: 400 },
    )
  }
}
