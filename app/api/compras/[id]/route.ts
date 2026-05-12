import { rm } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { requireAnyFeature, requireFeature } from '@/lib/auth/api'
import { isCompraLockedAfterAdminApproval } from '@/lib/domain'
import { getCompraDetail, permanentlyDeleteCompra, setCompraArchivedState, updateCompra } from '@/lib/repositories'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  ) {
  try {
    const guard = await requireAnyFeature(request, ['compras', 'autorizacoes', 'solicitacoes_autorizacao', 'financeiro', 'entregas'])
    if ('response' in guard) {
      return guard.response
    }

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
    const body = await request.json()
    const quoteEditableFields = [
      'fornecedor',
      'descricao',
      'data_envio_fornecedor',
      'valor_categoria_perfis',
      'valor_categoria_vidros',
      'valor_categoria_acessorios',
      'valor_categoria_perdas',
      'valor_categoria_outros',
    ] as const
    const bodyKeys = Object.keys(body)
    const isAuthorizationUpdate = body.status === 'pedido_autorizado'
    const isDeliveryRevision =
      body.status_entrega !== undefined ||
      body.data_entrega_real !== undefined ||
      body.previsao_entrega !== undefined ||
      body.numero_pedido !== undefined ||
      body.motivo_revisao !== undefined
    const isQuoteOperationalUpdate =
      bodyKeys.length > 0 &&
      bodyKeys.every((key) => quoteEditableFields.includes(key as (typeof quoteEditableFields)[number]))

    const guard = isAuthorizationUpdate
      ? await requireFeature(request, 'autorizacoes')
      : isDeliveryRevision
        ? await requireFeature(request, 'revisar_entrega')
        : isQuoteOperationalUpdate
          ? await requireAnyFeature(request, ['compras', 'editar_compra'])
        : await requireFeature(request, 'editar_compra')

    if ('response' in guard) {
      return guard.response
    }

    const { id } = await params
    const compraAtual = isQuoteOperationalUpdate ? await getCompraDetail(Number(id)) : null

    if (isQuoteOperationalUpdate && !compraAtual) {
      return NextResponse.json({ error: 'Compra nao encontrada.' }, { status: 404 })
    }

    if (typeof body.arquivado === 'boolean') {
      const archiveGuard = await requireFeature(request, 'editar_compra')
      if ('response' in archiveGuard) {
        return archiveGuard.response
      }

      const result = await setCompraArchivedState(Number(id), body.arquivado)
      return NextResponse.json({
        message: result.archived ? 'Pedido arquivado com sucesso.' : 'Pedido desarquivado com sucesso.',
        archived: result.archived,
      })
    }

    if (
      isQuoteOperationalUpdate &&
      guard.session.perfil !== 'admin' &&
      compraAtual &&
      isCompraLockedAfterAdminApproval(compraAtual)
    ) {
      return NextResponse.json(
        { error: 'Depois da aprovacao do ADM, alteracoes na compra exigem aprovacao administrativa.' },
        { status: 403 },
      )
    }

    if (!isAuthorizationUpdate && !isDeliveryRevision && guard.session.perfil !== 'admin') {
      if (isQuoteOperationalUpdate) {
        await updateCompra(Number(id), {
          fornecedor: body.fornecedor,
          descricao: body.descricao,
          data_envio_fornecedor: body.data_envio_fornecedor,
          valor_categoria_perfis: body.valor_categoria_perfis,
          valor_categoria_vidros: body.valor_categoria_vidros,
          valor_categoria_acessorios: body.valor_categoria_acessorios,
          valor_categoria_perdas: body.valor_categoria_perdas,
          valor_categoria_outros: body.valor_categoria_outros,
          usuario: guard.session.nome,
        })

        return NextResponse.json({ message: 'Dados operacionais da cotacao atualizados com sucesso.' })
      }

      return NextResponse.json(
        { error: 'Alteracoes sensiveis em compras exigem aprovacao administrativa.' },
        { status: 403 },
      )
    }

    await updateCompra(Number(id), {
      categoria: body.categoria,
      fornecedor: body.fornecedor,
      descricao: body.descricao,
      valor_total: body.valor_total,
      valor_categoria_perfis: body.valor_categoria_perfis,
      valor_categoria_vidros: body.valor_categoria_vidros,
      valor_categoria_acessorios: body.valor_categoria_acessorios,
      valor_categoria_perdas: body.valor_categoria_perdas,
      valor_categoria_outros: body.valor_categoria_outros,
      numero_pedido: body.numero_pedido,
      status: body.status,
      status_entrega: body.status_entrega,
      previsao_entrega: body.previsao_entrega,
      data_envio_fornecedor: body.data_envio_fornecedor,
      data_entrega_real: body.data_entrega_real,
      usuario: guard.session.nome,
      motivo_revisao: body.motivo_revisao ?? null,
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, 'editar_compra')
    if ('response' in guard) {
      return guard.response
    }

    const { id } = await params
    const compraAtual = await getCompraDetail(Number(id))

    if (!compraAtual) {
      return NextResponse.json({ error: 'Compra nao encontrada.' }, { status: 404 })
    }

    if (guard.session.perfil !== 'admin' && isCompraLockedAfterAdminApproval(compraAtual)) {
      return NextResponse.json(
        { error: 'Exclusoes de compras exigem aprovacao administrativa.' },
        { status: 403 },
      )
    }

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
