import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { getPropostaById, updateProposta } from "@/lib/repositories"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "orcamentos")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const proposta = await getPropostaById(Number(id))

    if (!proposta) {
      return NextResponse.json({ error: "Proposta nao encontrada." }, { status: 404 })
    }

    return NextResponse.json(proposta)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar orcamento." },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "orcamentos")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const proposta = await getPropostaById(Number(id))

    if (!proposta) {
      return NextResponse.json({ error: "Proposta nao encontrada." }, { status: 404 })
    }

    const body = await request.json()

    await updateProposta(Number(id), {
      cliente_id: proposta.cliente_id,
      nome: proposta.nome,
      data_inicio: proposta.data_inicio,
      data_fim: proposta.data_fim,
      valor_previsto: 0,
      valor_previsto_perfis: body.valor_previsto_perfis ?? proposta.valor_previsto_perfis,
      valor_previsto_vidros: body.valor_previsto_vidros ?? proposta.valor_previsto_vidros,
      valor_previsto_acessorios: body.valor_previsto_acessorios ?? proposta.valor_previsto_acessorios,
      valor_previsto_outros: body.valor_previsto_outros ?? proposta.valor_previsto_outros,
      custo_perdas: body.custo_perdas ?? proposta.custo_perdas,
    })

    return NextResponse.json({ message: "Orcamento atualizado com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar orcamento." },
      { status: 400 },
    )
  }
}
