import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { hasFeatureAccess } from "@/lib/auth/permissions"
import { getCompraById, requestCompraRetification } from "@/lib/repositories"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "solicitacoes")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const compra = await getCompraById(Number(id))

    if (!compra) {
      return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 })
    }

    const canRequestRetification =
      hasFeatureAccess(guard.session.perfil, "retificar_solicitacao", guard.session.features) &&
      (guard.session.perfil === "admin" ||
        compra.solicitante_id === guard.session.userId ||
        (!compra.solicitante_id && compra.solicitado_por?.trim() === guard.session.nome.trim()))

    if (!canRequestRetification) {
      return NextResponse.json({ error: "Voce nao pode retificar esta solicitacao." }, { status: 403 })
    }

    const body = await request.json()
    await requestCompraRetification(Number(id), guard.session.nome, String(body.motivo ?? ""))

    return NextResponse.json({ message: "Retificacao enviada com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao solicitar retificacao." },
      { status: 400 },
    )
  }
}
