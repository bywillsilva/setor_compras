import { NextRequest, NextResponse } from 'next/server'
import { requireFeature } from '@/lib/auth/api'
import { deleteCliente, getClienteById, setClienteArchivedState, updateCliente } from '@/lib/repositories'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, 'clientes')
    if ('response' in guard) {
      return guard.response
    }

    const { id } = await params
    const cliente = await getClienteById(Number(id))

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    return NextResponse.json(cliente)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar cliente.' },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, 'clientes')
    if ('response' in guard) {
      return guard.response
    }

    const { id } = await params
    const body = await request.json()

    if (typeof body.arquivado === 'boolean') {
      const result = await setClienteArchivedState(Number(id), body.arquivado)
      return NextResponse.json({
        message: result.archived ? 'Cliente arquivado com sucesso.' : 'Cliente desarquivado com sucesso.',
        archived: result.archived,
      })
    }

    if (!String(body.nome ?? '').trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    }

    await updateCliente(Number(id), {
      nome: String(body.nome).trim(),
      documento: body.documento ?? null,
      contato: body.contato ?? null,
      email: body.email ?? null,
    })

    return NextResponse.json({ message: 'Cliente atualizado com sucesso.' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar cliente.' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireFeature(request, 'clientes')
    if ('response' in guard) {
      return guard.response
    }

    const { id } = await params
    await deleteCliente(Number(id))
    return NextResponse.json({ message: 'Cliente excluído com sucesso.' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao excluir cliente.' },
      { status: 400 },
    )
  }
}
