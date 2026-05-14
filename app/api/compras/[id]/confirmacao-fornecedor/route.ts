import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { confirmCompraWithSupplier } from "@/lib/repositories"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "confirmar_fornecedor")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const body = await request.json()

    await confirmCompraWithSupplier(Number(id), guard.session.nome, String(body.previsao_entrega ?? ""))

    return NextResponse.json({ message: "Pedido confirmado com o fornecedor com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao confirmar pedido com o fornecedor." },
      { status: 400 },
    )
  }
}
