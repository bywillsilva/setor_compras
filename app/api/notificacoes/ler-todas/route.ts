import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/auth/api'
import { markAllNotificacoesAsLidas } from '@/lib/repositories'

export async function POST(request: NextRequest) {
  try {
    const session = await getRequestSession(request)

    if (!session) {
      return NextResponse.json({ error: 'Sessao expirada. Faca login novamente.' }, { status: 401 })
    }

    await markAllNotificacoesAsLidas(session.userId)
    return NextResponse.json({ message: 'Notificacoes marcadas como lidas.' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar notificacoes.' },
      { status: 500 },
    )
  }
}
