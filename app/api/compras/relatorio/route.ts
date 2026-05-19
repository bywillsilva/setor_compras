import { NextRequest, NextResponse } from "next/server"
import { format } from "date-fns"
import { requireFeature } from "@/lib/auth/api"
import { matchesDateRange } from "@/lib/date-range"
import { CATEGORIA_LABELS, ETAPA_FLUXO_LABELS } from "@/lib/domain"
import { listCompras } from "@/lib/repositories"
import type { Compra, EtapaFluxoCompra, StatusPedido } from "@/lib/types"

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
  },
) {
  const concluidos = compras.filter((compra) => compra.status_entrega === "entregue")
  const emAndamento = compras.filter(
    (compra) =>
      compra.status_entrega !== "entregue" &&
      (compra.status === "pedido_autorizado" ||
        compra.etapa_fluxo === "liberada_para_fornecedor" ||
        compra.etapa_fluxo === "pedido_autorizado"),
  )
  const aguardandoAutorizacao = compras.filter(
    (compra) => !concluidos.includes(compra) && !emAndamento.includes(compra),
  )
  const observacoes = buildObservations(compras)

  const lines = [
    "RELATORIO DE ACOMPANHAMENTO DE PEDIDOS",
    "",
    `Atualizacao: ${format(context.generatedAt, "dd/MM")}`,
    `Responsavel: ${sanitizeText(context.generatedBy)}`,
    `Total de pedidos nesta visao: ${compras.length}`,
    "",
  ]

  appendSection(lines, "STATUS: CONCLUIDO", concluidos, formatCompletedEntry)
  lines.push("------------------------", "")
  appendSection(lines, "STATUS: EM ANDAMENTO", emAndamento, formatOngoingEntry)
  lines.push("------------------------", "")
  appendSection(lines, "STATUS: AGUARDANDO AUTORIZACAO", aguardandoAutorizacao, formatPendingApprovalEntry)
  lines.push("------------------------", "", "OBSERVACOES", "")

  if (observacoes.length === 0) {
    lines.push("- Sem observacoes adicionais nesta visao.")
  } else {
    for (const observacao of observacoes) {
      lines.push(`- ${observacao}`)
    }
  }

  return buildSimplePdf(lines)
}

function buildSimplePdf(lines: string[]) {
  const wrappedLines = lines.flatMap((line) => wrapLine(line, 90))
  const pageHeight = 792
  const top = 760
  const left = 40
  const lineHeight = 14
  const maxLinesPerPage = 48
  const chunks: string[][] = []

  for (let index = 0; index < wrappedLines.length; index += maxLinesPerPage) {
    chunks.push(wrappedLines.slice(index, index + maxLinesPerPage))
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

function appendSection(
  lines: string[],
  title: string,
  compras: Compra[],
  formatter: (compra: Compra) => string[],
) {
  lines.push(title, "")

  if (compras.length === 0) {
    lines.push("- Nenhum pedido nesta situacao.", "")
    return
  }

  for (const compra of compras) {
    lines.push(...formatter(compra), "")
  }
}

function formatCompletedEntry(compra: Compra) {
  return [
    formatCompraHeading(compra),
    `OK entregue por ${sanitizeText(compra.fornecedor)} | ${sanitizeText(resolveProductLabel(compra))} -> ${formatShortDate(compra.data_entrega_real ?? compra.updated_at)}`,
  ]
}

function formatOngoingEntry(compra: Compra) {
  return [
    `Entrega prevista: ${formatShortDate(compra.previsao_entrega)} !`,
    "",
    formatCompraHeading(compra),
    "",
    `* Fornecedor: ${sanitizeText(compra.fornecedor)}`,
    `* Produto: ${sanitizeText(resolveProductLabel(compra))}`,
    `  Local: ${sanitizeText(resolveDeliveryLocation(compra))}`,
    `  Situacao: ${sanitizeText(resolveOngoingStatus(compra))}`,
  ]
}

function formatPendingApprovalEntry(compra: Compra) {
  return [
    formatCompraHeading(compra),
    "",
    `* Fornecedor: ${sanitizeText(compra.fornecedor)}`,
    `* Produto: ${sanitizeText(resolveProductLabel(compra))}`,
    `  Etapa: ${sanitizeText(resolvePendingApprovalLabel(compra.etapa_fluxo))}`,
    `  Atualizado em: ${formatDateTime(compra.updated_at)}`,
  ]
}

function formatCompraHeading(compra: Compra) {
  const cliente = sanitizeText(compra.cliente_nome ?? "Cliente nao informado")
  const proposta = sanitizeText(compra.proposta_nome ?? "")
  return proposta ? `${cliente} - ${proposta}` : cliente
}

function resolveProductLabel(compra: Compra) {
  const description = compra.descricao?.trim()
  if (description) {
    return description
  }

  return CATEGORIA_LABELS[compra.categoria]
}

function resolveDeliveryLocation(_compra: Compra) {
  return "Nao informado"
}

function resolveOngoingStatus(compra: Compra) {
  if (!compra.possui_nf || !compra.possui_boleto) {
    const pendencias = [
      !compra.possui_nf ? "NF pendente" : null,
      !compra.possui_boleto ? "boleto pendente" : null,
    ]
      .filter(Boolean)
      .join(" e ")
    return pendencias || "Em andamento"
  }

  if (!compra.documentos_financeiro_confirmados_em) {
    return "Aguardando baixa do financeiro"
  }

  return "Em rota de entrega"
}

function resolvePendingApprovalLabel(etapaFluxo: EtapaFluxoCompra) {
  switch (etapaFluxo) {
    case "solicitacao_registrada":
      return "Solicitacao registrada e aguardando inicio da cotacao"
    case "cotacao_em_andamento":
      return "Cotacao em andamento com o fornecedor"
    case "analise_solicitante":
      return "Aguardando aprovacao do ADM"
    case "retificacao":
      return "Em retificacao"
    case "aprovada_solicitante":
      return "Aguardando aprovacao do ADM"
    case "aguardando_admin":
      return "Aguardando aprovacao do ADM"
    case "aprovada_admin":
      return "Aprovada pelo ADM e pronta para envio ao financeiro"
    case "aguardando_financeiro":
      return "Aguardando aprovacao do financeiro"
    case "liberada_para_fornecedor":
      return "Liberada para fechamento com o fornecedor"
    case "pedido_autorizado":
      return "Pedido autorizado"
    default:
      return ETAPA_FLUXO_LABELS[etapaFluxo]
  }
}

function buildObservations(compras: Compra[]) {
  const notes: string[] = []

  for (const compra of compras) {
    const heading = formatCompraHeading(compra)

    if (
      compra.etapa_fluxo === "analise_solicitante" ||
      compra.etapa_fluxo === "aprovada_solicitante" ||
      compra.etapa_fluxo === "aguardando_admin"
    ) {
      notes.push(`${heading} aguardando aprovacao do ADM.`)
    } else if (compra.etapa_fluxo === "aguardando_financeiro") {
      notes.push(`${heading} aguardando aprovacao do financeiro.`)
    } else if (compra.etapa_fluxo === "retificacao") {
      notes.push(`${heading} retornou para retificacao e precisa de novo envio.`)
    }

    if (compra.status === "pedido_autorizado" && (!compra.possui_nf || !compra.possui_boleto)) {
      const pendencias = [
        !compra.possui_nf ? "nota fiscal" : null,
        !compra.possui_boleto ? "boleto" : null,
      ]
        .filter(Boolean)
        .join(" e ")

      notes.push(`${heading} esta sem ${pendencias} anexado(s).`)
    }

    if (
      compra.status === "pedido_autorizado" &&
      compra.possui_nf &&
      compra.possui_boleto &&
      !compra.documentos_financeiro_confirmados_em
    ) {
      notes.push(`${heading} ja possui NF e boleto, mas ainda aguarda baixa do financeiro.`)
    }
  }

  return Array.from(new Set(notes))
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "a definir"
  }

  return format(new Date(value), "dd/MM")
}

function formatDateTime(value: string) {
  return format(new Date(value), "dd/MM/yyyy HH:mm")
}

function wrapLine(line: string, maxLength: number) {
  const normalizedLine = sanitizeText(line)

  if (!normalizedLine) {
    return [""]
  }

  if (normalizedLine.length <= maxLength) {
    return [normalizedLine]
  }

  const words = normalizedLine.split(" ")
  const wrapped: string[] = []
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxLength) {
      current = next
      continue
    }

    if (current) {
      wrapped.push(current)
    }
    current = word
  }

  if (current) {
    wrapped.push(current)
  }

  return wrapped
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
