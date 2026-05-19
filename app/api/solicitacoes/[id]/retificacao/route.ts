import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "solicitacoes")
    if ("response" in guard) {
      return guard.response
    }

    await params

    return NextResponse.json(
      { error: "A retificacao pelo solicitante foi removida deste fluxo. Depois da cotacao, o pedido segue direto para o ADM." },
      { status: 410 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao solicitar retificacao." },
      { status: 400 },
    )
  }
}
