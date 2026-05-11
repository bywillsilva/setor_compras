import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { listFeaturesByPerfil } from "@/lib/repositories"
import { getUsuarioById, listFeaturesByUsuario, saveUsuarioFeatures } from "@/lib/repositories"
import type { AppFeature } from "@/lib/types"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "usuarios")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const usuario = await getUsuarioById(Number(id))

    if (!usuario) {
      return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 })
    }

    const [features, profileFeatures] = await Promise.all([
      listFeaturesByUsuario(usuario.id, usuario.perfil),
      listFeaturesByPerfil(usuario.perfil),
    ])

    return NextResponse.json({
      userId: usuario.id,
      perfil: usuario.perfil,
      features,
      profileFeatures,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar permissoes do usuario." },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, "usuarios")
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const usuario = await getUsuarioById(Number(id))

    if (!usuario) {
      return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 })
    }

    const body = await request.json()
    if (!Array.isArray(body.features)) {
      return NextResponse.json({ error: "Lista de modulos invalida." }, { status: 400 })
    }

    const features = await saveUsuarioFeatures(
      usuario.id,
      usuario.perfil,
      body.features.filter((feature: unknown): feature is AppFeature => typeof feature === "string"),
    )

    return NextResponse.json({
      message: "Permissoes do usuario atualizadas com sucesso.",
      userId: usuario.id,
      perfil: usuario.perfil,
      features,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar permissoes do usuario." },
      { status: 400 },
    )
  }
}
