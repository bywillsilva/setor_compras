import { NextRequest, NextResponse } from "next/server"
import { requireAnyFeature } from "@/lib/auth/api"
import { hasFeatureAccess } from "@/lib/auth/permissions"
import { getCompraDetail } from "@/lib/repositories"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireAnyFeature(request, ["solicitacoes", "compras"])
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const compra = await getCompraDetail(Number(id))

    if (!compra) {
      return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 })
    }

    const canViewAsCompras = hasFeatureAccess(guard.session.perfil, "compras", guard.session.features)

    if (!canViewAsCompras && compra.solicitante_id !== guard.session.userId) {
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
