import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns"
import type {
  CategoriaCompra,
  Compra,
  FinanceiroReportItem,
  PropostaFormData,
  SituacaoEntrega,
  StatusEntrega,
  StatusPedido,
  TipoAnexo,
} from "@/lib/types"

export const STATUS_OPTIONS: StatusPedido[] = [
  "cotacao",
  "em_analise",
  "retificacao",
  "pedido_autorizado",
]

export const STATUS_LABELS: Record<StatusPedido, string> = {
  cotacao: "Cotacao",
  em_analise: "Em Analise",
  retificacao: "Retificacao",
  pedido_autorizado: "Pedido Autorizado",
}

export const STATUS_BADGE_CLASSES: Record<StatusPedido, string> = {
  cotacao: "bg-amber-100 text-amber-800",
  em_analise: "bg-blue-100 text-blue-800",
  retificacao: "bg-orange-100 text-orange-800",
  pedido_autorizado: "bg-emerald-100 text-emerald-800",
}

export const STATUS_ENTREGA_LABELS: Record<StatusEntrega, string> = {
  pendente: "Pendente",
  entregue: "Entregue",
}

export const CATEGORIA_OPTIONS: CategoriaCompra[] = ["perfis", "vidros", "acessorios", "perdas"]

export const CATEGORIA_LABELS: Record<CategoriaCompra, string> = {
  perfis: "Perfis",
  vidros: "Vidros",
  acessorios: "Acessorios",
  perdas: "Perdas",
}

export const TIPO_ANEXO_LABELS: Record<TipoAnexo, string> = {
  cotacao: "Cotacao",
  nf: "Nota fiscal",
  boleto: "Boleto",
  outro: "Outro",
}

export function normalizeStatusPedido(value: unknown): StatusPedido {
  const normalized = normalizeKey(value)

  if (normalized === "em_analise" || normalized === "analise") {
    return "em_analise"
  }

  if (normalized === "retificacao") {
    return "retificacao"
  }

  if (normalized === "pedido_autorizado" || normalized === "autorizado") {
    return "pedido_autorizado"
  }

  return "cotacao"
}

export function normalizeStatusEntrega(value: unknown): StatusEntrega {
  return normalizeKey(value) === "entregue" ? "entregue" : "pendente"
}

export function normalizeCategoriaCompra(value: unknown): CategoriaCompra {
  const normalized = normalizeKey(value)

  if (normalized === "perfis") {
    return "perfis"
  }

  if (normalized === "vidros") {
    return "vidros"
  }

  if (normalized === "acessorios") {
    return "acessorios"
  }

  return "perdas"
}

export function getDeliverySituation(compra: Pick<Compra, "status" | "status_entrega" | "previsao_entrega">): SituacaoEntrega {
  if (compra.status_entrega === "entregue") {
    return "entregue"
  }

  if (compra.status !== "pedido_autorizado" || !compra.previsao_entrega) {
    return "pendente"
  }

  const today = startOfDay(new Date())
  const expectedDate = startOfDay(parseISO(compra.previsao_entrega))
  const remainingDays = differenceInCalendarDays(expectedDate, today)

  if (remainingDays < 0) {
    return "atrasado"
  }

  if (remainingDays <= 3) {
    return "proximo"
  }

  return "no_prazo"
}

export function getDeliverySituationLabel(situacao: SituacaoEntrega): string {
  switch (situacao) {
    case "entregue":
      return "Entregue"
    case "atrasado":
      return "Atrasado"
    case "proximo":
      return "Proximo do vencimento"
    case "no_prazo":
      return "Dentro do prazo"
    default:
      return "Pendente"
  }
}

export function resolvePropostaValues(input: Partial<PropostaFormData>) {
  const valorPrevistoPerfis = toNumber(input.valor_previsto_perfis)
  const valorPrevistoVidros = toNumber(input.valor_previsto_vidros)
  const valorPrevistoAcessorios = toNumber(input.valor_previsto_acessorios)
  const valorPrevistoOutros = toNumber(input.valor_previsto_outros)
  const totalCategorias =
    valorPrevistoPerfis +
    valorPrevistoVidros +
    valorPrevistoAcessorios +
    valorPrevistoOutros

  return {
    valor_previsto_perfis: valorPrevistoPerfis,
    valor_previsto_vidros: valorPrevistoVidros,
    valor_previsto_acessorios: valorPrevistoAcessorios,
    valor_previsto_outros: valorPrevistoOutros,
    custo_perdas: toNumber(input.custo_perdas),
    valor_previsto: totalCategorias,
  }
}

export function calculateFinanceDifference(item: Pick<FinanceiroReportItem, "valor_previsto" | "valor_realizado" | "custo_perdas">) {
  return Number(item.valor_previsto) - (Number(item.valor_realizado) + Number(item.custo_perdas))
}

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return 0
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}
