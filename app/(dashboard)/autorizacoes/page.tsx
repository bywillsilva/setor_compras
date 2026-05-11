"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle2, Eye, Loader2, Send } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ListFilterField, ListFilterGrid, ListFilterPanel } from "@/components/shared/list-filter-panel"
import { PageHeader, SectionCard, SummaryMetricCard } from "@/components/shared/page-layout"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { TableTextPreview } from "@/components/shared/table-text-preview"
import { SortableTableHead, TableFilterInput, type SortDirection } from "@/components/shared/table-tools"
import { useLiveRefresh } from "@/components/shared/use-live-refresh"
import { Badge } from "@/components/ui/badge"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { hasFeatureAccess } from "@/lib/auth/permissions"
import {
  ETAPA_FLUXO_BADGE_CLASSES,
  ETAPA_FLUXO_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/domain"
import type { Compra } from "@/lib/types"

type SortColumn = "pedido" | "cliente" | "etapa" | "atualizado"

export default function AutorizacoesPage() {
  const session = useCurrentSession()
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    pedido: "",
    cliente: "",
    etapa: "todos",
    updatedFrom: "",
    updatedTo: "",
  })
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "atualizado",
    direction: "desc",
  })
  const canRequestApproval = Boolean(
    session && hasFeatureAccess(session.perfil, "solicitar_autorizacao", session.features),
  )
  const canViewCompras = Boolean(session && hasFeatureAccess(session.perfil, "compras", session.features))

  async function fetchData(options: { silent?: boolean } = {}) {
    const { silent = false } = options

    try {
      if (!silent) {
        setLoading(true)
      }
      const response = await fetch("/api/compras", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Erro ao carregar fila de autorizacoes.")
      }

      setCompras(await response.json())
    } catch (error) {
      console.error(error)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void fetchData()
  }, [])

  useLiveRefresh(() => fetchData({ silent: true }), {
    enabled: processingId === null,
    intervalMs: 12000,
  })

  async function handleRequestAuthorization(compraId: number) {
    setProcessingId(compraId)

    try {
      const response = await fetch(`/api/compras/${compraId}/solicitacao-autorizacao`, { method: "POST" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao solicitar autorizacao.")
      }

      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao solicitar autorizacao.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleRequestFinance(compraId: number) {
    setProcessingId(compraId)

    try {
      const response = await fetch(`/api/compras/${compraId}/solicitacao-financeira`, { method: "POST" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao solicitar aprovacao financeira.")
      }

      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao solicitar aprovacao financeira.")
    } finally {
      setProcessingId(null)
    }
  }

  const filteredCompras = useMemo(() => {
    return compras
      .filter((compra) => compra.status !== "pedido_autorizado")
      .filter((compra) => {
        const matchesPedido =
          !filters.pedido ||
          `#${compra.id}`.toLowerCase().includes(filters.pedido.toLowerCase()) ||
          (compra.proposta_nome ?? "").toLowerCase().includes(filters.pedido.toLowerCase())
        const matchesCliente =
          !filters.cliente || (compra.cliente_nome ?? "").toLowerCase().includes(filters.cliente.toLowerCase())
        const matchesEtapa = filters.etapa === "todos" || compra.etapa_fluxo === filters.etapa
        const matchesUpdatedFrom = !filters.updatedFrom || compra.updated_at.slice(0, 10) >= filters.updatedFrom
        const matchesUpdatedTo = !filters.updatedTo || compra.updated_at.slice(0, 10) <= filters.updatedTo

        return matchesPedido && matchesCliente && matchesEtapa && matchesUpdatedFrom && matchesUpdatedTo
      })
      .sort((left, right) => sortCompras(left, right, sort))
  }, [compras, filters, sort])

  const resumo = useMemo(
    () => ({
      aguardandoSolicitante: filteredCompras.filter((compra) => compra.etapa_fluxo === "analise_solicitante").length,
      prontasParaSolicitarAdm: filteredCompras.filter((compra) => compra.etapa_fluxo === "aprovada_solicitante").length,
      aguardandoAdm: filteredCompras.filter((compra) => compra.etapa_fluxo === "aguardando_admin").length,
      prontasParaSolicitarFinanceiro: filteredCompras.filter((compra) => compra.etapa_fluxo === "aprovada_admin").length,
      aguardandoFinanceiro: filteredCompras.filter((compra) => compra.etapa_fluxo === "aguardando_financeiro").length,
      prontasParaFechar: filteredCompras.filter((compra) => compra.etapa_fluxo === "liberada_para_fornecedor").length,
    }),
    [filteredCompras],
  )

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
    <div className="space-y-6 p-6">
      <PageHeader
        title="Autorizacoes"
        description="Acompanhe toda a fila ligada a autorizacao, da analise do solicitante ate a liberacao para o fornecedor."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryMetricCard title="Em analise" value={resumo.aguardandoSolicitante} description="Esperando assinatura do solicitante" />
        <SummaryMetricCard title="Para ADM" value={resumo.prontasParaSolicitarAdm} description="Prontos para enviar ao ADM" />
        <SummaryMetricCard title="Aguardando ADM" value={resumo.aguardandoAdm} description="Pendentes de aprovacao administrativa" />
        <SummaryMetricCard title="Para financeiro" value={resumo.prontasParaSolicitarFinanceiro} description="ADM aprovou, falta envio ao financeiro" />
        <SummaryMetricCard title="Aguardando financeiro" value={resumo.aguardandoFinanceiro} description="Pendentes de ciencia financeira" />
        <SummaryMetricCard title="Liberados" value={resumo.prontasParaFechar} description="Prontos para fechar com o fornecedor" />
      </div>

      <SectionCard title="Fila do comprador" description={`${filteredCompras.length} pedido(s) nesta fila operacional`}>
        <ListFilterPanel
          trailing={
            <DateRangeFilter
              startDate={filters.updatedFrom}
              endDate={filters.updatedTo}
              onStartDateChange={(value) => setFilters((current) => ({ ...current, updatedFrom: value }))}
              onEndDateChange={(value) => setFilters((current) => ({ ...current, updatedTo: value }))}
              onClear={() => setFilters((current) => ({ ...current, updatedFrom: "", updatedTo: "" }))}
              startLabel="Atualizado de"
              endLabel="Atualizado ate"
            />
          }
        >
          <ListFilterGrid columns="grid gap-3 md:grid-cols-3">
            <ListFilterField label="Pedido">
              <TableFilterInput
                value={filters.pedido}
                onChange={(value) => setFilters((current) => ({ ...current, pedido: value }))}
                placeholder="ID ou proposta"
              />
            </ListFilterField>

            <ListFilterField label="Cliente">
              <TableFilterInput
                value={filters.cliente}
                onChange={(value) => setFilters((current) => ({ ...current, cliente: value }))}
                placeholder="Filtrar cliente"
              />
            </ListFilterField>

            <ListFilterField label="Etapa">
              <Select value={filters.etapa} onValueChange={(value) => setFilters((current) => ({ ...current, etapa: value }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="analise_solicitante">Em analise</SelectItem>
                  <SelectItem value="aprovada_solicitante">Para ADM</SelectItem>
                  <SelectItem value="aguardando_admin">Aguardando ADM</SelectItem>
                  <SelectItem value="aprovada_admin">Para financeiro</SelectItem>
                  <SelectItem value="aguardando_financeiro">Aguardando financeiro</SelectItem>
                  <SelectItem value="liberada_para_fornecedor">Liberada</SelectItem>
                </SelectContent>
              </Select>
            </ListFilterField>
          </ListFilterGrid>
        </ListFilterPanel>
        {filteredCompras.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            Nenhum pedido pendente de autorizacao neste momento.
          </div>
        ) : (
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
                      label="Cliente"
                      isActive={sort.column === "cliente"}
                      direction={sort.direction}
                      onClick={() => toggleSort("cliente")}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Etapa"
                      isActive={sort.column === "etapa"}
                      direction={sort.direction}
                      onClick={() => toggleSort("etapa")}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Atualizado"
                      isActive={sort.column === "atualizado"}
                      direction={sort.direction}
                      onClick={() => toggleSort("atualizado")}
                    />
                  </TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompras.map((compra) => {
                  const isProcessing = processingId === compra.id
                  const canRequestAuthorization = compra.etapa_fluxo === "aprovada_solicitante"
                  const canRequestFinance = compra.etapa_fluxo === "aprovada_admin"
                  const canFinalize = compra.etapa_fluxo === "liberada_para_fornecedor"

                  return (
                    <TableRow key={compra.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-mono text-sm font-medium">#{compra.id}</div>
                          <TableTextPreview
                            text={compra.proposta_nome}
                            fallback="Sem proposta"
                            className="max-w-[190px]"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{compra.cliente_nome}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>
                            {ETAPA_FLUXO_LABELS[compra.etapa_fluxo]}
                          </Badge>
                          <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu label={`Acoes do pedido ${compra.id}`}>
                          {canViewCompras ? (
                            <>
                              <DropdownMenuItem asChild>
                                <Link href={`/compras/${compra.id}`}>
                                  <Eye className="h-4 w-4" />
                                  Ver pedido
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          ) : null}

                          {canFinalize ? (
                            <DropdownMenuItem asChild>
                              <Link href={`/autorizacoes/${compra.id}`}>
                                <CheckCircle2 className="h-4 w-4" />
                                Confirmar com fornecedor
                              </Link>
                            </DropdownMenuItem>
                          ) : canRequestFinance && canRequestApproval ? (
                            <DropdownMenuItem onClick={() => handleRequestFinance(compra.id)} disabled={isProcessing}>
                              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              {isProcessing ? "Solicitando..." : "Solicitar assinatura do financeiro"}
                            </DropdownMenuItem>
                          ) : canRequestAuthorization && canRequestApproval ? (
                            <DropdownMenuItem onClick={() => handleRequestAuthorization(compra.id)} disabled={isProcessing}>
                              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              {isProcessing ? "Solicitando..." : "Solicitar assinatura do ADM"}
                            </DropdownMenuItem>
                          ) : compra.etapa_fluxo === "aguardando_admin" && canRequestApproval ? (
                            <DropdownMenuItem disabled>
                              <Loader2 className="h-4 w-4" />
                              Aguardando ADM
                            </DropdownMenuItem>
                          ) : compra.etapa_fluxo === "aguardando_financeiro" && canRequestApproval ? (
                            <DropdownMenuItem disabled>
                              <Loader2 className="h-4 w-4" />
                              Aguardando financeiro
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem asChild>
                              <Link href={`/solicitacoes/${compra.id}`}>
                                <Eye className="h-4 w-4" />
                                Acompanhar solicitacao
                              </Link>
                            </DropdownMenuItem>
                          )}
                        </RowActionsMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
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
    case "etapa":
      return ETAPA_FLUXO_LABELS[left.etapa_fluxo].localeCompare(ETAPA_FLUXO_LABELS[right.etapa_fluxo], "pt-BR") * modifier
    case "atualizado":
    default:
      return (new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()) * modifier
  }
}
