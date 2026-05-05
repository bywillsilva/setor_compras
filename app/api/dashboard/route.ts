import { NextRequest, NextResponse } from 'next/server'
import { requireFeature } from '@/lib/auth/api'
import { getDashboardData } from '@/lib/repositories'

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, 'dashboard')
    if ('response' in guard) {
      return guard.response
    }

    const data = await getDashboardData()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar dados do dashboard.' },
      { status: 500 },
    )
  }
}
