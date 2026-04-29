import { NextRequest, NextResponse } from 'next/server'
import { createCliente, listClientes } from '@/lib/repositories'

export async function GET() {
  try {
    const clientes = await listClientes()
    return NextResponse.json(clientes)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar clientes.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!String(body.nome ?? '').trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    }

    const id = await createCliente({
      nome: String(body.nome).trim(),
      documento: body.documento ?? null,
      contato: body.contato ?? null,
      email: body.email ?? null,
    })

    return NextResponse.json({ id, message: 'Cliente criado com sucesso.' }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar cliente.' },
      { status: 500 },
    )
  }
}
