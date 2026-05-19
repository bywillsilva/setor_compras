import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns"
import type {
  CategoriaCompra,
  Compra,
  EtapaFluxoCompra,
  EtapaAutorizacao,
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
  cotacao: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-50",
  em_analise: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-50",
  retificacao: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-400/40 dark:bg-orange-500/20 dark:text-orange-50",
  pedido_autorizado: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-50",
}

export const STATUS_ENTREGA_LABELS: Record<StatusEntrega, string> = {
  pendente: "Pendente",
  entregue: "Entregue",
}

export const ETAPA_AUTORIZACAO_LABELS: Record<EtapaAutorizacao, string> = {
  nenhuma: "Sem solicitacao",
  solicitada: "Solicitada",
  liberada: "Liberada",
}

export const ETAPA_AUTORIZACAO_BADGE_CLASSES: Record<EtapaAutorizacao, string> = {
  nenhuma: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-400/35 dark:bg-slate-500/18 dark:text-slate-50",
  solicitada: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-50",
  liberada: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-50",
}

export const ETAPA_FLUXO_LABELS: Record<EtapaFluxoCompra, string> = {
  solicitacao_registrada: "Solicitacao registrada",
  cotacao_em_andamento: "Cotacao em andamento",
  analise_solicitante: "Aguardando aprovacao ADM",
  retificacao: "Em retificacao",
  aprovada_solicitante: "Aguardando aprovacao ADM",
  aguardando_admin: "Aguardando aprovacao ADM",
  aprovada_admin: "Aprovada pelo ADM",
  aguardando_financeiro: "Aguardando ciencia financeira",
  liberada_para_fornecedor: "Liberada para fornecedor",
  pedido_autorizado: "Pedido autorizado",
}

export function getEtapaFluxoLabel(compra: Pick<Compra, "etapa_fluxo" | "solicitante_id">) {
  if (compra.etapa_fluxo === "analise_solicitante" || compra.etapa_fluxo === "aprovada_solicitante") {
    return "Aguardando aprovacao ADM"
  }

  return ETAPA_FLUXO_LABELS[compra.etapa_fluxo]
}

export function shouldShowCompraStatusBadge(compra: Pick<Compra, "status" | "etapa_fluxo">) {
  if (
    (compra.etapa_fluxo === "solicitacao_registrada" || compra.etapa_fluxo === "cotacao_em_andamento") &&
    compra.status === "cotacao"
  ) {
    return false
  }

  if (
    [
      "analise_solicitante",
      "aprovada_solicitante",
      "aguardando_admin",
      "aprovada_admin",
      "aguardando_financeiro",
      "liberada_para_fornecedor",
    ].includes(compra.etapa_fluxo) &&
    compra.status === "em_analise"
  ) {
    return false
  }

  if (compra.etapa_fluxo === "retificacao" && compra.status === "retificacao") {
    return false
  }

  if (compra.etapa_fluxo === "pedido_autorizado" && compra.status === "pedido_autorizado") {
    return false
  }

  return true
}

export function isCompraLockedAfterAdminApproval(
  compra: Pick<Compra, "etapa_fluxo" | "aprovado_admin_em" | "aprovado_admin_por">,
) {
  if (compra.aprovado_admin_em || compra.aprovado_admin_por) {
    return true
  }

  return ["aprovada_admin", "aguardando_financeiro", "liberada_para_fornecedor", "pedido_autorizado"].includes(
    compra.etapa_fluxo,
  )
}

export const ETAPA_FLUXO_BADGE_CLASSES: Record<EtapaFluxoCompra, string> = {
  solicitacao_registrada: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-400/35 dark:bg-slate-500/18 dark:text-slate-50",
  cotacao_em_andamento: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-50",
  analise_solicitante: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-500/20 dark:text-indigo-50",
  retificacao: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-400/40 dark:bg-orange-500/20 dark:text-orange-50",
  aprovada_solicitante: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-50",
  aguardando_admin: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-50",
  aprovada_admin: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-500/20 dark:text-sky-50",
  aguardando_financeiro: "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-400/40 dark:bg-yellow-500/20 dark:text-yellow-50",
  liberada_para_fornecedor: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/40 dark:bg-cyan-500/20 dark:text-cyan-50",
  pedido_autorizado: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-50",
}

export const CATEGORIA_OPTIONS: CategoriaCompra[] = ["perfis", "vidros", "acessorios", "perdas", "outros"]
export const COMPRA_RATEIO_OPTIONS: CategoriaCompra[] = ["perfis", "vidros", "acessorios", "perdas", "outros"]

export const CATEGORIA_LABELS: Record<CategoriaCompra, string> = {
  perfis: "Perfis",
  vidros: "Vidros",
  acessorios: "Acessorios",
  perdas: "Perdas/Reposicao",
  outros: "Outros",
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

export function normalizeEtapaAutorizacao(value: unknown): EtapaAutorizacao {
  const normalized = normalizeKey(value)

  if (normalized === "solicitada") {
    return "solicitada"
  }

  if (normalized === "liberada") {
    return "liberada"
  }

  return "nenhuma"
}

export function normalizeEtapaFluxoCompra(value: unknown): EtapaFluxoCompra {
  const normalized = normalizeKey(value)

  if (normalized === "cotacao_em_andamento") {
    return "cotacao_em_andamento"
  }

  if (normalized === "analise_solicitante") {
    return "analise_solicitante"
  }

  if (normalized === "retificacao") {
    return "retificacao"
  }

  if (normalized === "aprovada_solicitante") {
    return "aprovada_solicitante"
  }

  if (normalized === "aguardando_admin") {
    return "aguardando_admin"
  }

  if (normalized === "aprovada_admin") {
    return "aprovada_admin"
  }

  if (normalized === "aguardando_financeiro") {
    return "aguardando_financeiro"
  }

  if (normalized === "liberada_para_fornecedor") {
    return "liberada_para_fornecedor"
  }

  if (normalized === "pedido_autorizado") {
    return "pedido_autorizado"
  }

  return "solicitacao_registrada"
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

  if (normalized === "perdas" || normalized === "reposicao") {
    return "perdas"
  }

  return "outros"
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

export function resolveCompraCategoriaValues(
  input: Partial<
    Record<
      | "valor_categoria_perfis"
      | "valor_categoria_vidros"
      | "valor_categoria_acessorios"
      | "valor_categoria_perdas"
      | "valor_categoria_outros",
      number | null | undefined
    >
  >,
) {
  return {
    valor_categoria_perfis: toNumber(input.valor_categoria_perfis),
    valor_categoria_vidros: toNumber(input.valor_categoria_vidros),
    valor_categoria_acessorios: toNumber(input.valor_categoria_acessorios),
    valor_categoria_perdas: toNumber(input.valor_categoria_perdas),
    valor_categoria_outros: toNumber(input.valor_categoria_outros),
  }
}

export function getCompraCategoriaTotal(
  values: ReturnType<typeof resolveCompraCategoriaValues> | Pick<
    Compra,
    | "valor_categoria_perfis"
    | "valor_categoria_vidros"
    | "valor_categoria_acessorios"
    | "valor_categoria_perdas"
    | "valor_categoria_outros"
  >,
) {
  return (
    Number(values.valor_categoria_perfis ?? 0) +
    Number(values.valor_categoria_vidros ?? 0) +
    Number(values.valor_categoria_acessorios ?? 0) +
    Number(values.valor_categoria_perdas ?? 0) +
    Number(values.valor_categoria_outros ?? 0)
  )
}

export function getCompraCategoriaDistribuicao(compra: Pick<
  Compra,
  | "categoria"
  | "valor_total"
  | "valor_categoria_perfis"
  | "valor_categoria_vidros"
  | "valor_categoria_acessorios"
  | "valor_categoria_perdas"
  | "valor_categoria_outros"
>) {
  const values = resolveCompraCategoriaValues(compra)
  const total = getCompraCategoriaTotal(values)

  if (total > 0) {
    return values
  }

  const fallbackValues = resolveCompraCategoriaValues({})
  if (compra.valor_total) {
    fallbackValues[getCompraCategoriaFieldName(compra.categoria)] = Number(compra.valor_total)
  }
  return fallbackValues
}

export function getCompraCategoriaPrincipal(compra: Pick<
  Compra,
  | "categoria"
  | "valor_total"
  | "valor_categoria_perfis"
  | "valor_categoria_vidros"
  | "valor_categoria_acessorios"
  | "valor_categoria_perdas"
  | "valor_categoria_outros"
>) {
  const distribuicao = getCompraCategoriaDistribuicao(compra)
  const active = COMPRA_RATEIO_OPTIONS
    .map((categoria) => ({
      categoria,
      value: distribuicao[getCompraCategoriaFieldName(categoria)],
    }))
    .sort((left, right) => right.value - left.value)

  return active[0]?.value > 0 ? active[0].categoria : compra.categoria
}

export function getCompraCategoriasAtivas(compra: Pick<
  Compra,
  | "categoria"
  | "valor_total"
  | "valor_categoria_perfis"
  | "valor_categoria_vidros"
  | "valor_categoria_acessorios"
  | "valor_categoria_perdas"
  | "valor_categoria_outros"
>) {
  const distribuicao = getCompraCategoriaDistribuicao(compra)
  return COMPRA_RATEIO_OPTIONS.filter((categoria) => distribuicao[getCompraCategoriaFieldName(categoria)] > 0)
}

function getCompraCategoriaFieldName(categoria: CategoriaCompra) {
  switch (categoria) {
    case "perfis":
      return "valor_categoria_perfis" as const
    case "vidros":
      return "valor_categoria_vidros" as const
    case "acessorios":
      return "valor_categoria_acessorios" as const
    case "perdas":
      return "valor_categoria_perdas" as const
    default:
      return "valor_categoria_outros" as const
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
