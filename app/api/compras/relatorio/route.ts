import { NextRequest, NextResponse } from "next/server"
import { format } from "date-fns"
import { requireFeature } from "@/lib/auth/api"
import { matchesDateRange } from "@/lib/date-range"
import { ETAPA_FLUXO_LABELS, STATUS_LABELS } from "@/lib/domain"
import { listCompras } from "@/lib/repositories"
import type { Compra, StatusPedido } from "@/lib/types"

type SortOption =
  | "movimentacao_desc"
  | "movimentacao_asc"
  | "cliente_az"
  | "proposta_az"
  | "fornecedor_az"
  | "pedido_az"
  | "valor_desc"
  | "valor_asc"

export async function GET(request: NextRequest) {
  try {
    const guard = await requireFeature(request, "compras")
    if ("response" in guard) {
      return guard.response
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim().toLowerCase() ?? ""
    const status = (searchParams.get("status") as StatusPedido | null) ?? null
    const clienteId = searchParams.get("clienteId")
    const arquivados = searchParams.get("arquivados")
    const dateFrom = searchParams.get("dateFrom") ?? ""
    const dateTo = searchParams.get("dateTo") ?? ""
    const sortBy = (searchParams.get("sortBy") as SortOption | null) ?? "movimentacao_desc"

    const compras = await listCompras({
      clienteId: clienteId ? Number(clienteId) : undefined,
      status: status ?? undefined,
      includeArchived: arquivados === "todos",
      onlyArchived: arquivados === "arquivados",
    })

    const filteredCompras = [...compras]
      .filter((compra) => {
        if (!matchesDateRange(compra.updated_at, dateFrom, dateTo)) {
          return false
        }

        if (!search) {
          return true
        }

        return (
          compra.fornecedor.toLowerCase().includes(search) ||
          compra.descricao.toLowerCase().includes(search) ||
          compra.cliente_nome?.toLowerCase().includes(search) ||
          compra.proposta_nome?.toLowerCase().includes(search) ||
          compra.numero_pedido?.toLowerCase().includes(search)
        )
      })
      .sort((left, right) => sortCompras(left, right, sortBy))

    const pdf = buildComprasPdf(filteredCompras, {
      generatedBy: guard.session.nome,
      generatedAt: new Date(),
      filters: {
        search,
        status: status ?? "todos",
        clienteId: clienteId ?? "todos",
        arquivados: arquivados ?? "ativos",
        dateFrom,
        dateTo,
        sortBy,
      },
    })

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"relatorio-compras-${format(new Date(), "yyyyMMdd-HHmm")}.pdf\"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao gerar relatorio de compras." },
      { status: 500 },
    )
  }
}

function sortCompras(left: Compra, right: Compra, sortBy: SortOption) {
  switch (sortBy) {
    case "movimentacao_asc":
      return new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()
    case "cliente_az":
      return (left.cliente_nome ?? "").localeCompare(right.cliente_nome ?? "", "pt-BR")
    case "proposta_az":
      return (left.proposta_nome ?? "").localeCompare(right.proposta_nome ?? "", "pt-BR")
    case "fornecedor_az":
      return left.fornecedor.localeCompare(right.fornecedor, "pt-BR")
    case "pedido_az":
      return (left.numero_pedido ?? `#${left.id}`).localeCompare(right.numero_pedido ?? `#${right.id}`, "pt-BR")
    case "valor_desc":
      return Number(right.valor_total ?? 0) - Number(left.valor_total ?? 0)
    case "valor_asc":
      return Number(left.valor_total ?? 0) - Number(right.valor_total ?? 0)
    case "movimentacao_desc":
    default:
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  }
}

function buildComprasPdf(
  compras: Compra[],
  context: {
    generatedBy: string
    generatedAt: Date
    filters: Record<string, string>
  },
) {
  const lines = [
    "Relatorio de compras",
    `Gerado em: ${format(context.generatedAt, "dd/MM/yyyy HH:mm")}`,
    `Responsavel: ${sanitizeText(context.generatedBy)}`,
    `Filtros: busca=${context.filters.search || "-"} | status=${context.filters.status} | cliente=${context.filters.clienteId} | arquivados=${context.filters.arquivados}`,
    `Periodo: ${context.filters.dateFrom || "-"} ate ${context.filters.dateTo || "-"}`,
    `Ordenacao: ${context.filters.sortBy}`,
    `Total de pedidos: ${compras.length}`,
    "",
  ]

  for (const compra of compras) {
    const pendencias = [
      !compra.possui_nf ? "sem NF" : null,
      !compra.possui_boleto ? "sem boleto" : null,
      compra.status === "pedido_autorizado" &&
      compra.possui_nf &&
      compra.possui_boleto &&
      !compra.documentos_financeiro_confirmados_em
        ? "financeiro pendente"
        : null,
    ]
      .filter(Boolean)
      .join(", ")

    lines.push(
      `Pedido #${compra.id} | Cliente: ${sanitizeText(compra.cliente_nome ?? "-")} | Proposta: ${sanitizeText(compra.proposta_nome ?? "-")}`,
      `Fornecedor: ${sanitizeText(compra.fornecedor)} | Valor: ${formatCurrency(compra.valor_total)} | Status: ${STATUS_LABELS[compra.status]}`,
      `Fluxo: ${ETAPA_FLUXO_LABELS[compra.etapa_fluxo]} | Atualizacao: ${format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm")}`,
      `Pedido fornecedor: ${sanitizeText(compra.numero_pedido ?? "pendente")} | Previsao: ${sanitizeText(compra.previsao_entrega ?? "-")} | Entrega: ${sanitizeText(compra.status_entrega)}`,
      `Pendencias: ${pendencias || "nenhuma"}`,
      `Descricao: ${sanitizeText(compra.descricao || "-")}`,
      "",
    )
  }

  return buildSimplePdf(lines)
}

function buildSimplePdf(lines: string[]) {
  const pageHeight = 792
  const top = 760
  const left = 40
  const lineHeight = 14
  const maxLinesPerPage = 48
  const chunks: string[][] = []

  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    chunks.push(lines.slice(index, index + maxLinesPerPage))
  }

  const objects: string[] = []
  const pageObjectIds: number[] = []
  let objectId = 1

  const catalogId = objectId++
  const pagesId = objectId++

  for (const chunk of chunks) {
    const pageId = objectId++
    const contentId = objectId++
    pageObjectIds.push(pageId)

    const commands = ["BT", `/F1 10 Tf`]
    chunk.forEach((line, index) => {
      const y = top - index * lineHeight
      commands.push(`1 0 0 1 ${left} ${y} Tm (${escapePdfText(sanitizeText(line))}) Tj`)
    })
    commands.push("ET")

    const stream = commands.join("\n")
    objects[pageId] =
      `${pageId} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 ${pageHeight}] /Resources << /Font << /F1 ${contentId + 1} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj`
    objects[contentId] = `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`
    objects[contentId + 1] = `${contentId + 1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`
    objectId++
  }

  objects[catalogId] = `${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj`
  objects[pagesId] = `${pagesId} 0 obj\n<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>\nendobj`

  const orderedObjects = objects.filter(Boolean)
  let pdf = "%PDF-1.4\n"
  const offsets = [0]

  for (const object of orderedObjects) {
    offsets.push(pdf.length)
    pdf += `${object}\n`
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${orderedObjects.length + 1}\n`
  pdf += "0000000000 65535 f \n"
  for (let index = 1; index < offsets.length; index++) {
    pdf += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${orderedObjects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new TextEncoder().encode(pdf)
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function sanitizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
}

function formatCurrency(value: number | null) {
  if (!value) {
    return "-"
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value))
}
