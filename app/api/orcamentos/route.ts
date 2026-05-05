import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { listPropostas } from "@/lib/repositories"

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "orcamentos")
    if ("response" in guard) {
      return guard.response
    }

    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get("cliente_id")
    const arquivados = searchParams.get("arquivados")

    const propostas = await listPropostas({
      clienteId: clienteId ? Number(clienteId) : undefined,
      includeArchived: arquivados === "todos",
      onlyArchived: arquivados === "arquivados",
    })

    return NextResponse.json(propostas)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar orcamentos." },
      { status: 500 },
    )
  }
}
