import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { listClientes, listPropostas } from "@/lib/repositories"

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "solicitacoes")
    if ("response" in guard) {
      return guard.response
    }

    const [clientes, propostas] = await Promise.all([listClientes(), listPropostas()])
    return NextResponse.json({ clientes, propostas })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar referencias da solicitacao." },
      { status: 500 },
    )
  }
}
