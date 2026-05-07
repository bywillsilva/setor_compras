import { NextRequest, NextResponse } from "next/server"
import { normalizeFeatureList } from "@/lib/auth/permissions"
import { requireFeature } from "@/lib/auth/api"
import type { AppFeature, PerfilUsuario } from "@/lib/types"
import { listPerfilFeatureMatrix, savePerfilFeatureMatrix } from "@/lib/repositories"

const PERFIS: PerfilUsuario[] = ["admin", "comprador", "orcamentista", "solicitante", "financeiro"]

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "configuracoes")
    if ("response" in guard) {
      return guard.response
    }

    return NextResponse.json(await listPerfilFeatureMatrix())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar permissoes por perfil." },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "configuracoes")
    if ("response" in guard) {
      return guard.response
    }

    const body = await request.json()
    const nextMatrix = Object.fromEntries(
      PERFIS.map((perfil) => [perfil, normalizeFeatureList(asFeatureList(body?.[perfil]), perfil)]),
    ) as Record<PerfilUsuario, AppFeature[]>

    const saved = await savePerfilFeatureMatrix(nextMatrix)

    return NextResponse.json({
      message: "Permissoes atualizadas com sucesso.",
      permissoes: saved,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar permissoes por perfil." },
      { status: 400 },
    )
  }
}

function asFeatureList(value: unknown): AppFeature[] {
  return Array.isArray(value) ? (value.filter((item): item is AppFeature => typeof item === "string") as AppFeature[]) : []
}
