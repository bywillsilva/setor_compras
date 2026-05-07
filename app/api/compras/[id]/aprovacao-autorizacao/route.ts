import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { approveCompraAuthorizationRequest } from "@/lib/repositories"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "solicitacoes_autorizacao")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const body = await request.json()
    await approveCompraAuthorizationRequest(
      Number(id),
      guard.session.nome,
      String(body.numero_pedido ?? "").trim(),
      Number(body.valor_total ?? 0),
    )

    return NextResponse.json({ message: "Solicitacao aprovada com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao aprovar solicitacao." },
      { status: 400 },
    )
  }
}
