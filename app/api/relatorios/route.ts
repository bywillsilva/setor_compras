import { NextRequest, NextResponse } from 'next/server'
import type { StatusPedido } from '@/lib/types'
import {
  getComprasReport,
  getEntregasReport,
  getFinanceiroReport,
  getHistoricoReport,
} from '@/lib/repositories'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') ?? 'compras'
    const filters = {
      clienteId: searchParams.get('cliente_id') ? Number(searchParams.get('cliente_id')) : undefined,
      propostaId: searchParams.get('proposta_id') ? Number(searchParams.get('proposta_id')) : undefined,
      dataInicio: searchParams.get('data_inicio'),
      dataFim: searchParams.get('data_fim'),
      status: searchParams.get('status') ? (searchParams.get('status') as StatusPedido) : undefined,
    }

    if (tipo === 'financeiro') {
      return NextResponse.json({ dados: await getFinanceiroReport(filters) })
    }

    if (tipo === 'entregas') {
      return NextResponse.json(await getEntregasReport(filters))
    }

    if (tipo === 'historico') {
      return NextResponse.json({ dados: await getHistoricoReport(filters) })
    }

    return NextResponse.json({ dados: await getComprasReport(filters) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar relatório.' },
      { status: 500 },
    )
  }
}
