import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword } from '@/lib/auth/password'
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session'
import { ensureDefaultAdminUser, getSetupStatus, getUsuarioByEmail } from '@/lib/repositories'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const setupStatus = await getSetupStatus()

    if (!setupStatus.configured) {
      return NextResponse.json(
        { error: 'Configure o banco de dados antes de acessar o sistema.' },
        { status: 400 },
      )
    }

    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const senha = String(body.senha ?? '')

    if (!email || !senha) {
      return NextResponse.json({ error: 'Informe o email e a senha.' }, { status: 400 })
    }

    await ensureDefaultAdminUser()
    const usuario = await getUsuarioByEmail(email)

    if (!usuario || !usuario.ativo || !verifyPassword(senha, usuario.senha_hash)) {
      return NextResponse.json({ error: 'Email ou senha inválidos.' }, { status: 401 })
    }

    const token = await createSessionToken({
      userId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    })

    const response = NextResponse.json({
      message: 'Login realizado com sucesso.',
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
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
