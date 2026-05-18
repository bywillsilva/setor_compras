import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/auth/api'
import { markNotificacaoAsLida } from '@/lib/repositories'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRequestSession(request)

    if (!session) {
      return NextResponse.json({ error: 'Sessao expirada. Faca login novamente.' }, { status: 401 })
    }

    const { id } = await params
    await markNotificacaoAsLida(Number(id), session.userId)
    return NextResponse.json({ message: 'Notificacao marcada como lida.' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao marcar notificacao como lida.' },
      { status: 500 },
    )
  }
}
