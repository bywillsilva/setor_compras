import { NextRequest, NextResponse } from "next/server"
import { hasFeatureAccess, type AppFeature } from "@/lib/auth/permissions"
import { SESSION_COOKIE_NAME } from "@/lib/auth/session"
import { resolveSessionFromToken } from "@/lib/auth/resolved-session"

export async function getRequestSession(request: NextRequest) {
  return resolveSessionFromToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)
}

export async function requireFeature(request: NextRequest, feature: AppFeature) {
  const session = await getRequestSession(request)

  if (!session) {
    return {
      response: NextResponse.json({ error: "Sessao expirada. Faca login novamente." }, { status: 401 }),
    }
  }

  if (!hasFeatureAccess(session.perfil, feature, session.features)) {
    return {
      response: NextResponse.json({ error: "Voce nao tem permissao para esta acao." }, { status: 403 }),
    }
  }

  return { session }
}

export async function requireAnyFeature(request: NextRequest, features: AppFeature[]) {
  const session = await getRequestSession(request)

  if (!session) {
    return {
      response: NextResponse.json({ error: "Sessao expirada. Faca login novamente." }, { status: 401 }),
    }
  }

  if (!features.some((feature) => hasFeatureAccess(session.perfil, feature, session.features))) {
    return {
      response: NextResponse.json({ error: "Voce nao tem permissao para esta acao." }, { status: 403 }),
    }
  }

  return { session }
}
