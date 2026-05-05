import { NextRequest, NextResponse } from 'next/server'
import { requireFeature } from '@/lib/auth/api'
import { deleteProposta, getPropostaById, setPropostaArchivedState, updateProposta } from '@/lib/repositories'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, 'propostas')
    if ('response' in guard) {
      return guard.response
    }

    const { id } = await params
    const proposta = await getPropostaById(Number(id))

    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })
    }

    return NextResponse.json(proposta)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar proposta.' },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, 'editar_proposta')
    if ('response' in guard) {
      return guard.response
    }

    const { id } = await params
    const body = await request.json()

    if (typeof body.arquivado === 'boolean') {
      const result = await setPropostaArchivedState(Number(id), body.arquivado)
      return NextResponse.json({
        message: result.archived ? 'Proposta arquivada com sucesso.' : 'Proposta desarquivada com sucesso.',
        archived: result.archived,
      })
    }

    if (!body.cliente_id || !String(body.nome ?? '').trim()) {
      return NextResponse.json({ error: 'Cliente e nome são obrigatórios.' }, { status: 400 })
    }

    await updateProposta(Number(id), {
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

    return NextResponse.json({ message: 'Proposta atualizada com sucesso.' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar proposta.' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, 'editar_proposta')
    if ('response' in guard) {
      return guard.response
    }

    const { id } = await params
    await deleteProposta(Number(id))
    return NextResponse.json({ message: 'Proposta excluída com sucesso.' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao excluir proposta.' },
      { status: 400 },
    )
  }
}
