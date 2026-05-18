import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { rejectCompraAuthorizationRequest } from "@/lib/repositories"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "recusar_compra_admin")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))

    await rejectCompraAuthorizationRequest(Number(id), guard.session.nome, String(body.motivo ?? ""), guard.session.userId)

    return NextResponse.json({ message: "Solicitacao devolvida ao comprador." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao recusar solicitacao." },
      { status: 400 },
    )
  }
}
