import { NextResponse, type NextRequest } from "next/server"
import { getDefaultPathForPerfil, getFeatureForPath, hasFeatureAccess } from "@/lib/auth/permissions"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session"

const PUBLIC_PAGE_PATHS = new Set(["/auth/login"])
const PUBLIC_API_PATHS = new Set(["/api/auth/login", "/api/auth/logout", "/api/setup"])

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)

  if (pathname === "/auth/login") {
    if (!session) {
      return NextResponse.next()
    }

    return redirectToDefaultPath(request, session.perfil)
  }

  if (pathname === "/configuracoes") {
    if (!session) {
      return NextResponse.next()
    }

    if (hasFeatureAccess(session.perfil, "configuracoes")) {
      return NextResponse.next()
    }

    return redirectToDefaultPath(request, session.perfil)
  }

  if (!session && (PUBLIC_PAGE_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname))) {
    return NextResponse.next()
  }

  if (session && pathname === "/" && session.perfil === "orcamentista") {
    const url = request.nextUrl.clone()
    url.pathname = "/orcamentos"
    url.search = ""
    return NextResponse.redirect(url)
  }

  if (session) {
    const feature = getFeatureForPath(pathname)

    if (feature && !hasFeatureAccess(session.perfil, feature)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Voce nao tem permissao para acessar este recurso." }, { status: 403 })
      }

      return redirectToDefaultPath(request, session.perfil)
    }

    return NextResponse.next()
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sessao expirada. Faca login novamente." }, { status: 401 })
  }

  const url = request.nextUrl.clone()
  url.pathname = "/auth/login"
  url.searchParams.set("next", pathname)
  return NextResponse.redirect(url)
}

function redirectToDefaultPath(request: NextRequest, perfil: "admin" | "comprador" | "orcamentista") {
  const url = request.nextUrl.clone()
  url.pathname = getDefaultPathForPerfil(perfil)
  url.search = ""
  return NextResponse.redirect(url)
}

function isStaticAsset(pathname: string) {
  return pathname.startsWith("/_next") || pathname.startsWith("/uploads/") || /\.[a-zA-Z0-9]+$/.test(pathname)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
