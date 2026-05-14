import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { approveCompraFinanceiro } from "@/lib/repositories"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "aprovar_compra_financeiro")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    await approveCompraFinanceiro(Number(id), guard.session.nome)

    return NextResponse.json({ message: "Ciencia financeira registrada com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao registrar aprovacao financeira." },
      { status: 400 },
    )
  }
}
