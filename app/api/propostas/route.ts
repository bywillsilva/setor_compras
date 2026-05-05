import { NextRequest, NextResponse } from 'next/server'
import { requireFeature } from '@/lib/auth/api'
import { createProposta, listPropostas } from '@/lib/repositories'

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, 'propostas')
    if ('response' in guard) {
      return guard.response
    }

    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('cliente_id')
    const arquivados = searchParams.get('arquivados')

    const propostas = await listPropostas({
      clienteId: clienteId ? Number(clienteId) : undefined,
      includeArchived: arquivados === 'todos',
      onlyArchived: arquivados === 'arquivados',
    })

    return NextResponse.json(propostas)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar propostas.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireFeature(request, 'propostas')
    if ('response' in guard) {
      return guard.response
    }

    const body = await request.json()

    if (!body.cliente_id || !String(body.nome ?? '').trim()) {
      return NextResponse.json({ error: 'Cliente e nome são obrigatórios.' }, { status: 400 })
    }

    const id = await createProposta({
      cliente_id: Number(body.cliente_id),
      nome: String(body.nome).trim(),
      data_inicio: body.data_inicio ?? null,
      data_fim: body.data_fim ?? null,
      valor_previsto: 0,
      valor_previsto_perfis: body.valor_previsto_perfis ?? 0,
      valor_previsto_vidros: body.valor_previsto_vidros ?? 0,
      valor_previsto_acessorios: body.valor_previsto_acessorios ?? 0,
      valor_previsto_outros: body.valor_previsto_outros ?? 0,
      custo_perdas: body.custo_perdas ?? 0,
    })

    return NextResponse.json({ id, message: 'Proposta criada com sucesso.' }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar proposta.' },
      { status: 500 },
    )
  }
}
