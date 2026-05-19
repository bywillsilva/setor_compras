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
    await markCompraQuotationReceived(Number(id), guard.session.nome, guard.session.userId)

    return NextResponse.json({
      message: "Cotacao registrada e enviada para aprovacao do ADM.",
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao registrar recebimento da cotacao." },
      { status: 400 },
    )
  }
}
