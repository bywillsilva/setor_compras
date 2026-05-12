import { NextRequest, NextResponse } from 'next/server'
import { requireFeature } from '@/lib/auth/api'
import { getHistoricoReport } from '@/lib/repositories'

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, 'dashboard')
    if ('response' in guard) {
      return guard.response
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim().toLowerCase() ?? ''
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const updates = await getHistoricoReport({
      dataInicio: dateFrom || null,
      dataFim: dateTo || null,
    })

    const filtered = !search
      ? updates
      : updates.filter((item) =>
          [
            `#${item.compra_id}`,
            item.usuario,
            item.evento,
            item.fornecedor,
            item.cliente_nome,
            item.proposta_nome,
          ]
            .join(' ')
            .toLowerCase()
            .includes(search),
        )

    return NextResponse.json(filtered)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar atualizacoes recentes.' },
      { status: 500 },
    )
  }
}
