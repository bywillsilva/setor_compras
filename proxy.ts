import { NextResponse, type NextRequest } from "next/server"
import { getDefaultPathForPerfil } from "@/lib/auth/permissions"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session"
import type { AppFeature, PerfilUsuario } from "@/lib/types"

const PUBLIC_PAGE_PATHS = new Set(["/auth/login"])
const PUBLIC_API_PATHS = new Set(["/api/auth/login", "/api/auth/logout", "/api/setup"])

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const hasSessionCookie = Boolean(token)

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  const session = await verifySessionToken(token)
  const invalidSessionCookie = hasSessionCookie && !session

  if (pathname === "/auth/login") {
    if (!session) {
      const response = NextResponse.next()
      if (invalidSessionCookie) {
        clearSessionCookie(response)
      }
      return response
    }

    return redirectToDefaultPath(request, session.perfil, session.features)
  }

  if (!session && PUBLIC_PAGE_PATHS.has(pathname)) {
    const response = NextResponse.next()
    if (invalidSessionCookie) {
      clearSessionCookie(response)
    }
    return response
  }

  if (!session && PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  if (session && pathname === "/") {
    const defaultPath = getDefaultPathForPerfil(session.perfil, session.features)
    if (defaultPath !== "/") {
      const url = request.nextUrl.clone()
      url.pathname = defaultPath
      url.search = ""
      return NextResponse.redirect(url)
    }
  }

  if (session) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.json({ error: "Sessao expirada. Faca login novamente." }, { status: 401 })
    if (invalidSessionCookie) {
      clearSessionCookie(response)
    }
    return response
  }

  const url = request.nextUrl.clone()
  url.pathname = "/auth/login"
  url.searchParams.set("next", pathname)
  const response = NextResponse.redirect(url)
  if (invalidSessionCookie) {
    clearSessionCookie(response)
  }
  return response
}

function redirectToDefaultPath(request: NextRequest, perfil: PerfilUsuario, features?: AppFeature[]) {
  const url = request.nextUrl.clone()
  url.pathname = getDefaultPathForPerfil(perfil, features)
  url.search = ""
  return NextResponse.redirect(url)
}

function isStaticAsset(pathname: string) {
  return pathname.startsWith("/_next") || pathname.startsWith("/uploads/") || /\.[a-zA-Z0-9]+$/.test(pathname)
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
