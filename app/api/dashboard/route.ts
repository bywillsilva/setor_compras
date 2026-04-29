import { NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/repositories'

export async function GET() {
  try {
    const data = await getDashboardData()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar dados do dashboard.' },
      { status: 500 },
    )
  }
}
