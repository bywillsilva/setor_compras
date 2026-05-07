import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { getCompraDetail } from "@/lib/repositories"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "solicitacoes")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const compra = await getCompraDetail(Number(id))

    if (!compra) {
      return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 })
    }

    if (compra.solicitante_id !== guard.session.userId) {
      return NextResponse.json({ error: "Voce nao tem acesso a esta solicitacao." }, { status: 403 })
    }

    return NextResponse.json(compra)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar solicitacao." },
      { status: 500 },
    )
  }
}
