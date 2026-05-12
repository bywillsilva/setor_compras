import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { createResumoContrato, listResumosContratos } from "@/lib/repositories"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "resumo_contratos")
    if ("response" in guard) {
      return guard.response
    }

    const data = await listResumosContratos()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar resumos de contratos." },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "resumo_contratos")
    if ("response" in guard) {
      return guard.response
    }

    const body = await request.json()
    const id = await createResumoContrato(body, {
      userId: guard.session.userId,
      nome: guard.session.nome,
    })

    return NextResponse.json({ id, message: "Resumo de contratos criado com sucesso." }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar resumo de contratos." },
      { status: 400 },
    )
  }
}
