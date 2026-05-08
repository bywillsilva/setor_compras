import { NextRequest, NextResponse } from "next/server"
import { getRequestSession, requireFeature } from "@/lib/auth/api"
import { hasFeatureAccess } from "@/lib/auth/permissions"
import { createSensitiveChangeRequest, listSensitiveChangeRequests } from "@/lib/repositories"
import type {
  AppFeature,
  SolicitacaoSensivelAcao,
  SolicitacaoSensivelEntidade,
  SolicitacaoSensivelStatus,
} from "@/lib/types"

export const dynamic = "force-dynamic"

const ENTITY_FEATURE_MAP: Record<SolicitacaoSensivelEntidade, AppFeature> = {
  cliente: "clientes",
  proposta: "propostas",
  compra: "compras",
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "configuracoes")
    if ("response" in guard) {
      return guard.response
    }

    if (guard.session.perfil !== "admin") {
      return NextResponse.json({ error: "Apenas administradores podem revisar estas solicitacoes." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") as SolicitacaoSensivelStatus | null
    const requests = await listSensitiveChangeRequests({
      status: status ?? undefined,
    })

    return NextResponse.json(requests)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar solicitacoes sensiveis." },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getRequestSession(request)

    if (!session) {
      return NextResponse.json({ error: "Sessao expirada. Faca login novamente." }, { status: 401 })
    }

    const body = await request.json()
    const entidade = normalizeEntity(body.entidade)
    const acao = normalizeAction(body.acao)
    const entidadeId = Number(body.entidade_id)

    if (!entidade || !acao || !Number.isFinite(entidadeId) || entidadeId <= 0) {
      return NextResponse.json({ error: "Solicitacao invalida." }, { status: 400 })
    }

    const requiredFeature = ENTITY_FEATURE_MAP[entidade]
    if (!hasFeatureAccess(session.perfil, requiredFeature, session.features)) {
      return NextResponse.json({ error: "Voce nao tem acesso a este modulo." }, { status: 403 })
    }

    if (session.perfil === "admin") {
      return NextResponse.json(
        { error: "Administradores podem executar a alteracao diretamente, sem abrir solicitacao." },
        { status: 400 },
      )
    }

    const requestId = await createSensitiveChangeRequest({
      entidade,
      entidade_id: entidadeId,
      acao,
      motivo: typeof body.motivo === "string" ? body.motivo : null,
      payload: isPayloadObject(body.payload) ? body.payload : null,
      solicitante_id: session.userId,
      solicitante_nome: session.nome,
      solicitante_perfil: session.perfil,
    })

    return NextResponse.json({
      message: "Solicitacao enviada ao administrador.",
      id: requestId,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao registrar solicitacao sensivel." },
      { status: 400 },
    )
  }
}

function normalizeEntity(value: unknown) {
  const current = String(value ?? "").toLowerCase()
  if (current === "cliente" || current === "proposta" || current === "compra") {
    return current as SolicitacaoSensivelEntidade
  }

  return null
}

function normalizeAction(value: unknown) {
  const current = String(value ?? "").toLowerCase()
  if (current === "editar" || current === "excluir") {
    return current as SolicitacaoSensivelAcao
  }

  return null
}

function isPayloadObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
