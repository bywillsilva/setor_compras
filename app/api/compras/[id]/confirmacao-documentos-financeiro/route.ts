import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { confirmCompraFinanceDocuments } from "@/lib/repositories"

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
    await confirmCompraFinanceDocuments(Number(id), guard.session.nome)

    return NextResponse.json({ message: "Registro financeiro de nota fiscal e boleto concluido." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao concluir o registro financeiro dos documentos." },
      { status: 400 },
    )
  }
}
