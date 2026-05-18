import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/auth/api'
import { countUnreadNotificacoes, listNotificacoesByUsuario } from '@/lib/repositories'

export async function GET(request: NextRequest) {
  try {
    const session = await getRequestSession(request)

    if (!session) {
      return NextResponse.json({ error: 'Sessao expirada. Faca login novamente.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('status') !== 'todas'
    const limit = Number(searchParams.get('limit') ?? '12')

    const [items, unreadCount] = await Promise.all([
      listNotificacoesByUsuario(session.userId, { unreadOnly, limit }),
      countUnreadNotificacoes(session.userId),
    ])

    return NextResponse.json({
      items,
      unreadCount,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar notificacoes.' },
      { status: 500 },
    )
  }
}
