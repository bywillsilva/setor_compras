import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import type { PerfilUsuario } from "@/lib/types"
import { createUsuario, listUsuarios } from "@/lib/repositories"

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "usuarios")
    if ("response" in guard) {
      return guard.response
    }

    const usuarios = await listUsuarios()
    return NextResponse.json(usuarios.map(serializeUsuario))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar usuarios." },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "usuarios")
    if ("response" in guard) {
      return guard.response
    }

    const body = await request.json()

    if (!String(body.nome ?? "").trim() || !String(body.email ?? "").trim() || !String(body.senha ?? "").trim()) {
      return NextResponse.json({ error: "Nome, email e senha sao obrigatorios." }, { status: 400 })
    }

    const id = await createUsuario({
      nome: String(body.nome).trim(),
      email: String(body.email).trim(),
      senha: String(body.senha),
      perfil: normalizePerfil(body.perfil),
      ativo: body.ativo !== false,
    })

    return NextResponse.json({ id, message: "Usuario criado com sucesso." }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar usuario." },
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
