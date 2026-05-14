"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { AlertTriangle, CheckCircle2, Download, Eye, Loader2, Plus, Send, Truck } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ListPaginationBar, useListPagination } from "@/components/shared/list-pagination"
import { ListFilterField, ListFilterGrid, ListFilterPanel } from "@/components/shared/list-filter-panel"
import { PageHeader, SectionCard } from "@/components/shared/page-layout"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { TableTextPreview } from "@/components/shared/table-text-preview"
import { SortableTableHead, TableFilterInput, type SortDirection } from "@/components/shared/table-tools"
import { useLiveRefresh } from "@/components/shared/use-live-refresh"
import { DeliveryStatusBadge } from "@/components/compras/delivery-status-badge"
import { hasFeatureAccess } from "@/lib/auth/permissions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  CATEGORIA_LABELS,
  ETAPA_FLUXO_BADGE_CLASSES,
  ETAPA_FLUXO_LABELS,
  getEtapaFluxoLabel,
  STATUS_LABELS,
} from "@/lib/domain"
import type { Compra } from "@/lib/types"

const ARCHIVE_FILTER_LABELS = {
  ativos: "Ativos",
  arquivados: "Arquivados",
  todos: "Todos",
} as const

type SortColumn = "pedido" | "cliente" | "fornecedor" | "valor" | "movimentacao"

export default function ComprasPage() {
  const session = useCurrentSession()
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    pedido: "",
    cliente: "",
    fornecedor: "",
    etapa: "todos",
    archive: "ativos" as keyof typeof ARCHIVE_FILTER_LABELS,
    valorMin: "",
    valorMax: "",
    updatedFrom: "",
    updatedTo: "",
  })
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "movimentacao",
    direction: "desc",
  })
  const canRequestApproval = Boolean(
    session && hasFeatureAccess(session.perfil, "solicitar_autorizacao", session.features),
  )
  const canFinalizeFornecedor = Boolean(
    session && hasFeatureAccess(session.perfil, "confirmar_fornecedor", session.features),
  )

  async function fetchCompras(
    selectedArchiveFilter = filters.archive,
    options: { silent?: boolean } = {},
  ) {
    const { silent = false } = options

    try {
      if (!silent) {
        setLoading(true)
      }
      const query = selectedArchiveFilter === "ativos" ? "" : `?arquivados=${selectedArchiveFilter}`
      const comprasResponse = await fetch(`/api/compras${query}`, { cache: "no-store" })

      if (comprasResponse.ok) {
        setCompras(await comprasResponse.json())
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void fetchCompras(filters.archive)
  }, [filters.archive])

  useLiveRefresh(() => fetchCompras(filters.archive, { silent: true }), {
    enabled: processingId === null,
    intervalMs: 12000,
  })

  async function runWorkflowAction(compraId: number, path: string, successMessage: string) {
    setProcessingId(compraId)

    try {
      const response = await fetch(path, { method: "POST" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao atualizar fluxo da compra.")
      }

      alert(payload?.message || successMessage)
      await fetchCompras(filters.archive)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar fluxo da compra.")
    } finally {
      setProcessingId(null)
    }
  }

  const filteredCompras = useMemo(() => {
    return [...compras]
      .filter((compra) => {
        const matchesPedido =
          !filters.pedido ||
          `#${compra.id}`.toLowerCase().includes(filters.pedido.toLowerCase()) ||
          (compra.numero_pedido ?? "").toLowerCase().includes(filters.pedido.toLowerCase())
        const matchesCliente =
          !filters.cliente ||
          (compra.cliente_nome ?? "").toLowerCase().includes(filters.cliente.toLowerCase()) ||
          (compra.proposta_nome ?? "").toLowerCase().includes(filters.cliente.toLowerCase())
        const matchesFornecedor =
          !filters.fornecedor ||
          compra.fornecedor.toLowerCase().includes(filters.fornecedor.toLowerCase()) ||
          compra.descricao.toLowerCase().includes(filters.fornecedor.toLowerCase())
        const matchesEtapa = filters.etapa === "todos" || compra.etapa_fluxo === filters.etapa
        const value = Number(compra.valor_total ?? 0)
        const min = filters.valorMin ? Number(filters.valorMin) : null
        const max = filters.valorMax ? Number(filters.valorMax) : null
        const matchesMin = min === null || Number.isNaN(min) ? true : value >= min
        const matchesMax = max === null || Number.isNaN(max) ? true : value <= max
        const matchesUpdatedFrom = !filters.updatedFrom || compra.updated_at.slice(0, 10) >= filters.updatedFrom
        const matchesUpdatedTo = !filters.updatedTo || compra.updated_at.slice(0, 10) <= filters.updatedTo

        return (
          matchesPedido &&
          matchesCliente &&
          matchesFornecedor &&
          matchesEtapa &&
          matchesMin &&
          matchesMax &&
          matchesUpdatedFrom &&
          matchesUpdatedTo
        )
      })
      .sort((left, right) => sortCompras(left, right, sort))
  }, [compras, filters, sort])
  const pagination = useListPagination(filteredCompras, {
    storageKey: "compras-list-page-size",
    resetKey: JSON.stringify(filters),
  })

  const reportHref = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.pedido.trim()) params.set("search", filters.pedido.trim())
    if (filters.etapa !== "todos") params.set("status", filters.etapa)
    if (filters.archive !== "ativos") params.set("arquivados", filters.archive)
    if (filters.updatedFrom) params.set("dateFrom", filters.updatedFrom)
    if (filters.updatedTo) params.set("dateTo", filters.updatedTo)
    params.set("sortBy", `${sort.column}_${sort.direction}`)
    return `/api/compras/relatorio?${params.toString()}`
  }, [filters, sort])

  function toggleSort(column: SortColumn) {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === "asc" ? "desc" : "asc",
    }))
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Compras"
        description="Fila operacional do comprador, desde a solicitacao inicial ate a entrega do material."
        actions={
          <>
            <Button asChild variant="outline">
              <a href={reportHref}>
                <Download className="mr-2 h-4 w-4" />
                Baixar relatorio
              </a>
            </Button>
            <Link href="/compras/novo">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova compra
              </Button>
            </Link>
          </>
        }
      />

      <SectionCard
        title="Pedidos de compra"
        description={`${filteredCompras.length} pedido(s) encontrado(s) mostrando ${ARCHIVE_FILTER_LABELS[filters.archive].toLowerCase()}`}
      >
        <ListFilterPanel
          trailing={
            <DateRangeFilter
              startDate={filters.updatedFrom}
              endDate={filters.updatedTo}
              onStartDateChange={(value) => setFilters((current) => ({ ...current, updatedFrom: value }))}
              onEndDateChange={(value) => setFilters((current) => ({ ...current, updatedTo: value }))}
              onClear={() => setFilters((current) => ({ ...current, updatedFrom: "", updatedTo: "" }))}
              startLabel="Movimentacao de"
              endLabel="Movimentacao ate"
            />
          }
        >
          <ListFilterGrid columns="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <ListFilterField label="Pedido">
              <TableFilterInput
                value={filters.pedido}
                onChange={(value) => setFilters((current) => ({ ...current, pedido: value }))}
                placeholder="ID ou numero"
              />
            </ListFilterField>

            <ListFilterField label="Cliente ou proposta">
              <TableFilterInput
                value={filters.cliente}
                onChange={(value) => setFilters((current) => ({ ...current, cliente: value }))}
                placeholder="Buscar cliente ou proposta"
              />
            </ListFilterField>

            <ListFilterField label="Fornecedor ou material">
              <TableFilterInput
                value={filters.fornecedor}
                onChange={(value) => setFilters((current) => ({ ...current, fornecedor: value }))}
                placeholder="Buscar fornecedor ou material"
              />
            </ListFilterField>

            <ListFilterField label="Fluxo">
              <Select value={filters.etapa} onValueChange={(value) => setFilters((current) => ({ ...current, etapa: value }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="solicitacao_registrada">Registrada</SelectItem>
                  <SelectItem value="cotacao_em_andamento">Em cotacao</SelectItem>
                  <SelectItem value="analise_solicitante">Em analise</SelectItem>
                  <SelectItem value="retificacao">Retificacao</SelectItem>
                  <SelectItem value="aprovada_solicitante">Aprovada solicitante</SelectItem>
                  <SelectItem value="aguardando_admin">Aguardando ADM</SelectItem>
                  <SelectItem value="aprovada_admin">Aprovada ADM</SelectItem>
                  <SelectItem value="aguardando_financeiro">Aguardando financeiro</SelectItem>
                  <SelectItem value="liberada_para_fornecedor">Liberada</SelectItem>
                  <SelectItem value="pedido_autorizado">Pedido autorizado</SelectItem>
                </SelectContent>
              </Select>
            </ListFilterField>

            <ListFilterField label="Visualizacao">
              <Select
                value={filters.archive}
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, archive: value as keyof typeof ARCHIVE_FILTER_LABELS }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Ativos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="arquivados">Arquivados</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </ListFilterField>
          </ListFilterGrid>

          <ListFilterGrid columns="grid gap-3 md:grid-cols-2">
            <ListFilterField label="Valor minimo">
              <TableFilterInput
                value={filters.valorMin}
                onChange={(value) => setFilters((current) => ({ ...current, valorMin: value }))}
                placeholder="0,00"
              />
            </ListFilterField>

            <ListFilterField label="Valor maximo">
              <TableFilterInput
                value={filters.valorMax}
                onChange={(value) => setFilters((current) => ({ ...current, valorMax: value }))}
                placeholder="0,00"
              />
            </ListFilterField>
          </ListFilterGrid>
        </ListFilterPanel>
        {filteredCompras.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p>{filters.archive === "arquivados" ? "Nenhuma compra arquivada encontrada." : "Nenhum pedido encontrado."}</p>
            {filters.archive !== "arquivados" ? (
              <Link href="/compras/novo" className="text-sm text-primary hover:underline">
                Criar primeiro pedido
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortableTableHead
                        label="Pedido"
                        isActive={sort.column === "pedido"}
                        direction={sort.direction}
                        onClick={() => toggleSort("pedido")}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Cliente e proposta"
                        isActive={sort.column === "cliente"}
                        direction={sort.direction}
                        onClick={() => toggleSort("cliente")}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Fornecedor"
                        isActive={sort.column === "fornecedor"}
                        direction={sort.direction}
                        onClick={() => toggleSort("fornecedor")}
                      />
                    </TableHead>
                    <TableHead>Fluxo</TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Valor"
                        isActive={sort.column === "valor"}
                        direction={sort.direction}
                        onClick={() => toggleSort("valor")}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Movimentacao"
                        isActive={sort.column === "movimentacao"}
                        direction={sort.direction}
                        onClick={() => toggleSort("movimentacao")}
                      />
                    </TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.items.map((compra) => {
                    const isProcessing = processingId === compra.id
                    const skipRequesterApproval = !compra.solicitante_id
                    const documentosPendentes = [!compra.possui_nf ? "NF" : null, !compra.possui_boleto ? "boleto" : null].filter(Boolean)
                    const aguardandoRegistroFinanceiro =
                      compra.status === "pedido_autorizado" &&
                      compra.possui_nf &&
                      compra.possui_boleto &&
                      !compra.documentos_financeiro_confirmados_em

                    return (
                      <TableRow key={compra.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="font-mono text-sm font-medium">#{compra.id}</div>
                              {compra.arquivado ? <Badge variant="outline">Arquivado</Badge> : null}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {compra.numero_pedido ? `Pedido ${compra.numero_pedido}` : "Numero pendente"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[190px] space-y-1">
                            <div className="font-medium">{compra.cliente_nome}</div>
                            <TableTextPreview text={compra.proposta_nome} fallback="Sem proposta" className="max-w-[190px]" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[190px] space-y-1">
                            <div className="font-medium text-foreground">{compra.fornecedor}</div>
                            <TableTextPreview text={compra.descricao} className="max-w-[190px]" />
                            <Badge variant="outline">{CATEGORIA_LABELS[compra.categoria]}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[280px] space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>
                                {getEtapaFluxoLabel(compra)}
                              </Badge>
                              {compra.status === "pedido_autorizado" ? <DeliveryStatusBadge compra={compra} /> : null}
                            </div>
                            <p className="text-xs leading-5 text-muted-foreground">{getCompraFlowNote(compra)}</p>
                            {compra.status === "pedido_autorizado" && documentosPendentes.length > 0 ? (
                              <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-50">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {`Pendencias: ${documentosPendentes.join(" e ")}`}
                              </div>
                            ) : null}
                            {aguardandoRegistroFinanceiro ? (
                              <div className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/20 dark:text-sky-50">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Financeiro ainda precisa registrar NF e boleto
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">
                              {compra.valor_total
                                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(compra.valor_total))
                                : "-"}
                            </div>
                            <div className="text-xs text-muted-foreground">{STATUS_LABELS[compra.status]}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div>{format(parseISO(compra.updated_at), "dd/MM/yyyy", { locale: ptBR })}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(parseISO(compra.updated_at), "HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActionsMenu label={`Acoes do pedido ${compra.id}`}>
                            <DropdownMenuItem asChild>
                              <Link href={`/compras/${compra.id}`}>
                                <Eye className="h-4 w-4" />
                                Abrir pedido
                              </Link>
                            </DropdownMenuItem>

                            {!compra.arquivado ? (
                              <>
                                <DropdownMenuSeparator />
                                {compra.etapa_fluxo === "solicitacao_registrada" || compra.etapa_fluxo === "retificacao" ? (
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    onClick={() =>
                                      runWorkflowAction(
                                        compra.id,
                                        `/api/compras/${compra.id}/envio-cotacao`,
                                        "Solicitacao enviada para cotacao.",
                                      )
                                    }
                                  >
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    {isProcessing ? "Enviando..." : "Enviar para cotacao"}
                                  </DropdownMenuItem>
                                ) : compra.etapa_fluxo === "cotacao_em_andamento" ? (
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    onClick={() =>
                                      runWorkflowAction(
                                        compra.id,
                                        `/api/compras/${compra.id}/recebimento-cotacao`,
                                        skipRequesterApproval
                                          ? "Cotacao registrada e enviada diretamente para aprovacao do ADM."
                                          : "Cotacao enviada para aprovacao do solicitante.",
                                      )
                                    }
                                  >
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    {isProcessing
                                      ? "Solicitando..."
                                      : skipRequesterApproval
                                        ? "Enviar cotacao para aprovacao do ADM"
                                        : "Solicitar aprovacao do solicitante"}
                                  </DropdownMenuItem>
                                ) : compra.etapa_fluxo === "analise_solicitante" ? (
                                  <DropdownMenuItem disabled>
                                    <Loader2 className="h-4 w-4" />
                                    Aguardando solicitante
                                  </DropdownMenuItem>
                                ) : canRequestApproval && compra.etapa_fluxo === "aprovada_solicitante" ? (
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    onClick={() =>
                                      runWorkflowAction(
                                        compra.id,
                                        `/api/compras/${compra.id}/solicitacao-autorizacao`,
                                        "Solicitacao enviada ao administrador.",
                                      )
                                    }
                                  >
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                    {isProcessing ? "Solicitando..." : "Solicitar aprovacao do ADM"}
                                  </DropdownMenuItem>
                                ) : compra.etapa_fluxo === "aguardando_admin" ? (
                                  <DropdownMenuItem disabled>
                                    <Loader2 className="h-4 w-4" />
                                    Aguardando ADM
                                  </DropdownMenuItem>
                                ) : canRequestApproval && compra.etapa_fluxo === "aprovada_admin" ? (
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    onClick={() =>
                                      runWorkflowAction(
                                        compra.id,
                                        `/api/compras/${compra.id}/solicitacao-financeira`,
                                        "Solicitacao enviada ao financeiro.",
                                      )
                                    }
                                  >
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                    {isProcessing ? "Solicitando..." : "Solicitar aprovacao do financeiro"}
                                  </DropdownMenuItem>
                                ) : compra.etapa_fluxo === "aguardando_financeiro" ? (
                                  <DropdownMenuItem disabled>
                                    <Loader2 className="h-4 w-4" />
                                    Aguardando financeiro
                                  </DropdownMenuItem>
                                ) : canFinalizeFornecedor && compra.etapa_fluxo === "liberada_para_fornecedor" ? (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/autorizacoes/${compra.id}`}>
                                      <CheckCircle2 className="h-4 w-4" />
                                      Fechar com fornecedor
                                    </Link>
                                  </DropdownMenuItem>
                                ) : compra.status === "pedido_autorizado" ? (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/entregas/${compra.id}`}>
                                      <Truck className="h-4 w-4" />
                                      {compra.status_entrega === "entregue" ? "Revisar entrega" : "Informar entrega"}
                                    </Link>
                                  </DropdownMenuItem>
                                ) : canRequestApproval ? (
                                  <DropdownMenuItem disabled>
                                    <AlertTriangle className="h-4 w-4" />
                                    Sem acao imediata
                                  </DropdownMenuItem>
                                ) : null}
                              </>
                            ) : null}
                          </RowActionsMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <ListPaginationBar
              currentPage={pagination.currentPage}
              endItem={pagination.endItem}
              itemLabel="pedido(s)"
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              pageSize={pagination.pageSize}
              startItem={pagination.startItem}
              totalItems={pagination.totalItems}
              totalPages={pagination.totalPages}
            />
          </>
        )}
      </SectionCard>
    </div>
  )
}

function sortCompras(left: Compra, right: Compra, sort: { column: SortColumn; direction: SortDirection }) {
  const modifier = sort.direction === "asc" ? 1 : -1

  switch (sort.column) {
    case "pedido":
      return (`#${left.id}`.localeCompare(`#${right.id}`, "pt-BR")) * modifier
    case "cliente":
      return ((left.cliente_nome ?? "").localeCompare(right.cliente_nome ?? "", "pt-BR")) * modifier
    case "fornecedor":
      return left.fornecedor.localeCompare(right.fornecedor, "pt-BR") * modifier
    case "valor":
      return (Number(left.valor_total ?? 0) - Number(right.valor_total ?? 0)) * modifier
    case "movimentacao":
    default:
      return (new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()) * modifier
  }
}

function getCompraFlowNote(compra: Compra) {
  switch (compra.etapa_fluxo) {
    case "solicitacao_registrada":
      return "Material solicitado pela producao e aguardando envio do comprador para cotacao."
    case "cotacao_em_andamento":
      return compra.data_envio_fornecedor
        ? `Cotacao enviada ao fornecedor em ${format(parseISO(compra.data_envio_fornecedor), "dd/MM/yyyy", { locale: ptBR })}.`
        : "Cotacao em andamento com o fornecedor."
    case "analise_solicitante":
      return "Comprador ja anexou a cotacao e aguarda a aprovacao do solicitante."
    case "retificacao":
      return "Solicitante pediu ajuste antes do envio para a aprovacao administrativa."
    case "aprovada_solicitante":
      return compra.solicitante_id
        ? "Solicitante aprovou a cotacao; o proximo passo e enviar para o ADM."
        : "Compra direta do comprador pronta para envio ao ADM."
    case "aguardando_admin":
      return "Aguardando a assinatura administrativa para seguir com a compra."
    case "aprovada_admin":
      return "ADM aprovou com numero e valor. Falta solicitar a assinatura do financeiro."
    case "aguardando_financeiro":
      return "Financeiro precisa aprovar antes do fechamento com o fornecedor."
    case "liberada_para_fornecedor":
      return "Todas as assinaturas foram registradas. Falta fechar com o fornecedor."
    case "pedido_autorizado":
      return compra.previsao_entrega
        ? `Pedido fechado com o fornecedor. Previsao de entrega em ${format(parseISO(compra.previsao_entrega), "dd/MM/yyyy", { locale: ptBR })}.`
        : "Pedido fechado com o fornecedor."
    default:
      return "Pedido em acompanhamento."
  }
}
