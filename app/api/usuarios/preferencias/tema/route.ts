import { NextRequest, NextResponse } from "next/server"
import { getRequestSession } from "@/lib/auth/api"
import { saveUsuarioTheme } from "@/lib/repositories"
import {
  normalizeThemePreference,
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_COOKIE_NAME,
} from "@/lib/theme"

export async function PUT(request: NextRequest) {
  try {
    const session = await getRequestSession(request)

    if (!session) {
      return NextResponse.json({ error: "Sessao expirada. Faca login novamente." }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const tema = normalizeThemePreference(body?.tema)
    await saveUsuarioTheme(session.userId, tema)

    const response = NextResponse.json({ message: "Tema atualizado com sucesso.", tema })
    response.cookies.set(THEME_COOKIE_NAME, tema, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: THEME_COOKIE_MAX_AGE_SECONDS,
    })

    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar preferencia de tema." },
      { status: 400 },
    )
  }
}
