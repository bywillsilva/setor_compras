import { NextRequest, NextResponse } from "next/server"
import { requireFeature } from "@/lib/auth/api"
import { createCompra, listCompras } from "@/lib/repositories"

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "solicitacoes")
    if ("response" in guard) {
      return guard.response
    }

    const compras =
      guard.session.perfil === "admin"
        ? await listCompras()
        : await listCompras({
            solicitanteId: guard.session.userId,
            solicitanteNome: guard.session.nome,
          })

    return NextResponse.json(compras.filter((compra) => Boolean(compra.solicitante_id || compra.solicitado_por?.trim())))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar solicitacoes." },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "solicitacoes")
    if ("response" in guard) {
      return guard.response
    }

    const body = await request.json()

    if (!body.cliente_id || !body.proposta_id || !String(body.fornecedor ?? "").trim()) {
      return NextResponse.json(
        { error: "Cliente, proposta e fornecedor sao obrigatorios." },
        { status: 400 },
      )
    }

    const id = await createCompra({
      cliente_id: Number(body.cliente_id),
      proposta_id: Number(body.proposta_id),
      solicitante_id: guard.session.userId,
      solicitado_por: guard.session.nome,
      categoria: body.categoria ?? "outros",
      fornecedor: String(body.fornecedor).trim(),
      descricao: String(body.descricao ?? "").trim(),
    })

    return NextResponse.json({ id, message: "Solicitacao criada com sucesso." }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar solicitacao." },
      { status: 400 },
    )
  }
}
