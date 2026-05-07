import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { approveCompraByRequester, getCompraById } from "@/lib/repositories"

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

    if (compra.solicitante_id !== guard.session.userId) {
      return NextResponse.json({ error: "Voce nao pode aprovar esta solicitacao." }, { status: 403 })
    }

    await approveCompraByRequester(Number(id), guard.session.nome)

    return NextResponse.json({ message: "Solicitacao aprovada com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao aprovar solicitacao." },
      { status: 400 },
    )
  }
}
