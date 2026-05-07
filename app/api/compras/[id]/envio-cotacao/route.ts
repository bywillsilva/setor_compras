import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { markCompraQuotationSent } from "@/lib/repositories"

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
    const body = await request.json().catch(() => ({}))

    await markCompraQuotationSent(Number(id), guard.session.nome, {
      data_envio_fornecedor: typeof body.data_envio_fornecedor === "string" ? body.data_envio_fornecedor : null,
    })

    return NextResponse.json({ message: "Solicitacao enviada para cotacao com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao registrar envio para cotacao." },
      { status: 400 },
    )
  }
}
