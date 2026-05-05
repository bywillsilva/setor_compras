import { NextRequest, NextResponse } from 'next/server'
import { requireFeature } from '@/lib/auth/api'
import type { EtapaAutorizacao, StatusPedido } from '@/lib/types'
import { createCompra, listCompras } from '@/lib/repositories'

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, 'compras')
    if ('response' in guard) {
      return guard.response
    }

    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('cliente_id')
    const propostaId = searchParams.get('proposta_id')
    const status = searchParams.get('status')
    const etapaAutorizacao = searchParams.get('etapa_autorizacao')
    const arquivados = searchParams.get('arquivados')

    const compras = await listCompras({
      clienteId: clienteId ? Number(clienteId) : undefined,
      propostaId: propostaId ? Number(propostaId) : undefined,
      status: status ? (status as StatusPedido) : undefined,
      etapaAutorizacao: etapaAutorizacao ? (etapaAutorizacao as EtapaAutorizacao) : undefined,
      includeArchived: arquivados === 'todos',
      onlyArchived: arquivados === 'arquivados',
    })

    return NextResponse.json(compras)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar compras.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireFeature(request, 'compras')
    if ('response' in guard) {
      return guard.response
    }

    const body = await request.json()

    if (!body.cliente_id || !body.proposta_id || !String(body.fornecedor ?? '').trim() || !String(body.descricao ?? '').trim()) {
      return NextResponse.json(
        { error: 'Cliente, proposta, fornecedor e descrição são obrigatórios.' },
        { status: 400 },
      )
    }

    const id = await createCompra({
      cliente_id: Number(body.cliente_id),
      proposta_id: Number(body.proposta_id),
      categoria: body.categoria ?? 'outros',
      fornecedor: String(body.fornecedor).trim(),
      descricao: String(body.descricao).trim(),
      valor_total: body.valor_total ?? null,
      valor_categoria_perfis: body.valor_categoria_perfis ?? null,
      valor_categoria_vidros: body.valor_categoria_vidros ?? null,
      valor_categoria_acessorios: body.valor_categoria_acessorios ?? null,
      valor_categoria_perdas: body.valor_categoria_perdas ?? null,
      valor_categoria_outros: body.valor_categoria_outros ?? null,
      numero_pedido: body.numero_pedido ?? null,
      previsao_entrega: body.previsao_entrega ?? null,
      data_envio_fornecedor: body.data_envio_fornecedor ?? null,
    })

    return NextResponse.json({ id, message: 'Compra criada com sucesso.' }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar compra.' },
      { status: 500 },
    )
  }
}
