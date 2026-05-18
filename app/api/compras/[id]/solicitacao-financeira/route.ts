import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { requestCompraFinanceApproval } from "@/lib/repositories"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "solicitar_autorizacao")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    await requestCompraFinanceApproval(Number(id), guard.session.nome, guard.session.userId)

    return NextResponse.json({ message: "Solicitacao enviada ao financeiro." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao solicitar aprovacao financeira." },
      { status: 400 },
    )
  }
}
