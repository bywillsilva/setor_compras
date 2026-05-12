import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { deleteResumoContrato, getResumoContratoById, updateResumoContrato } from "@/lib/repositories"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireFeature(request, "resumo_contratos")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await context.params
    const resumoId = Number(id)

    if (!Number.isFinite(resumoId) || resumoId <= 0) {
      return NextResponse.json({ error: "Resumo de contratos inválido." }, { status: 400 })
    }

    const data = await getResumoContratoById(resumoId)
    if (!data) {
      return NextResponse.json({ error: "Resumo de contratos não encontrado." }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar resumo de contratos." },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireFeature(request, "resumo_contratos")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await context.params
    const resumoId = Number(id)

    if (!Number.isFinite(resumoId) || resumoId <= 0) {
      return NextResponse.json({ error: "Resumo de contratos inválido." }, { status: 400 })
    }

    const body = await request.json()
    await updateResumoContrato(resumoId, body)

    return NextResponse.json({ message: "Resumo de contratos atualizado com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar resumo de contratos." },
      { status: 400 },
    )
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireFeature(request, "resumo_contratos")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await context.params
    const resumoId = Number(id)

    if (!Number.isFinite(resumoId) || resumoId <= 0) {
      return NextResponse.json({ error: "Resumo de contratos inválido." }, { status: 400 })
    }

    await deleteResumoContrato(resumoId)
    return NextResponse.json({ message: "Resumo de contratos excluído com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir resumo de contratos." },
      { status: 400 },
    )
  }
}
