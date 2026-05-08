import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { approveSensitiveChangeRequest } from "@/lib/repositories"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireFeature(request, "configuracoes")
    if ("response" in guard) {
      return guard.response
    }

    if (guard.session.perfil !== "admin") {
      return NextResponse.json({ error: "Apenas administradores podem aprovar solicitacoes." }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    await approveSensitiveChangeRequest(Number(id), guard.session.nome, typeof body.observacao_admin === "string" ? body.observacao_admin : null)

    return NextResponse.json({ message: "Solicitacao aprovada com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao aprovar solicitacao." },
      { status: 400 },
    )
  }
}
