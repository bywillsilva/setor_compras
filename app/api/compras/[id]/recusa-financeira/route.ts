import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { rejectCompraFinanceiro } from "@/lib/repositories"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "financeiro")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))

    await rejectCompraFinanceiro(Number(id), guard.session.nome, String(body.motivo ?? ""))

    return NextResponse.json({ message: "Pedido devolvido ao comprador." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao recusar liberacao financeira." },
      { status: 400 },
    )
  }
}
