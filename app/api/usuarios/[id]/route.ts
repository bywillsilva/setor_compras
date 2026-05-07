import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import type { PerfilUsuario } from "@/lib/types"
import { getUsuarioById, updateUsuario } from "@/lib/repositories"

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

    return NextResponse.json(serializeUsuario(usuario))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar usuario." },
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
    const body = await request.json()

    if (!String(body.nome ?? "").trim() || !String(body.email ?? "").trim()) {
      return NextResponse.json({ error: "Nome e email sao obrigatorios." }, { status: 400 })
    }

    await updateUsuario(Number(id), {
      nome: String(body.nome).trim(),
      email: String(body.email).trim(),
      senha: body.senha ? String(body.senha) : null,
      perfil: normalizePerfil(body.perfil),
      ativo: body.ativo !== false,
    })

    return NextResponse.json({ message: "Usuario atualizado com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar usuario." },
      { status: 400 },
    )
  }
}

function normalizePerfil(value: unknown): PerfilUsuario {
  return value === "admin" ||
    value === "orcamentista" ||
    value === "solicitante" ||
    value === "financeiro"
    ? value
    : "comprador"
}

function serializeUsuario(usuario: {
  id: number
  nome: string
  email: string
  perfil: PerfilUsuario
  ativo: boolean
  created_at: string
  updated_at: string
}) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    ativo: usuario.ativo,
    created_at: usuario.created_at,
    updated_at: usuario.updated_at,
  }
}
