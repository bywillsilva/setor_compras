import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { markCompraQuotationReceived } from "@/lib/repositories"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "compras")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const result = await markCompraQuotationReceived(Number(id), guard.session.nome)

    return NextResponse.json({
      message: result.skippedRequesterApproval
        ? "Cotacao registrada e enviada diretamente para aprovacao do ADM."
        : "Cotacao registrada e enviada para analise do solicitante.",
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao registrar recebimento da cotacao." },
      { status: 400 },
    )
  }
}
