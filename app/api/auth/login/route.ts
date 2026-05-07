import { NextRequest, NextResponse } from 'next/server'
import { getDefaultFeaturesForPerfil } from '@/lib/auth/permissions'
import { verifyPassword } from '@/lib/auth/password'
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session'
import { ensureDefaultAdminUser, getUsuarioByEmail, listFeaturesByPerfil } from '@/lib/repositories'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const senha = String(body.senha ?? '')

    if (!email || !senha) {
      return NextResponse.json({ error: 'Informe o email e a senha.' }, { status: 400 })
    }

    await ensureDefaultAdminUser()
    const usuario = await getUsuarioByEmail(email)

    if (!usuario || !usuario.ativo || !verifyPassword(senha, usuario.senha_hash)) {
      return NextResponse.json({ error: 'Email ou senha invalidos.' }, { status: 401 })
    }

    let features = getDefaultFeaturesForPerfil(usuario.perfil)
    try {
      features = await listFeaturesByPerfil(usuario.perfil)
    } catch (permissionError) {
      console.warn(
        'Falha ao carregar permissoes por perfil no login. Aplicando permissoes padrao temporariamente.',
        permissionError,
      )
    }

    const token = await createSessionToken({
      userId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      features,
    })

    const response = NextResponse.json({
      message: 'Login realizado com sucesso.',
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        features,
      },
    })

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    })

    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao realizar login.' },
      { status: 500 },
    )
  }
}
