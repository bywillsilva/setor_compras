import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { listResumoContratoReferencias } from "@/lib/repositories"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "resumo_contratos")
    if ("response" in guard) {
      return guard.response
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const data = await listResumoContratoReferencias(search)

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar obras disponíveis." },
      { status: 500 },
    )
  }
}
