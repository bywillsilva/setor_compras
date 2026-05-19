"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Eye, Plus } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ListPaginationBar, useListPagination } from "@/components/shared/list-pagination"
import { ListFilterField, ListFilterGrid, ListFilterPanel } from "@/components/shared/list-filter-panel"
import { PageHeader, SectionCard, SummaryMetricCard } from "@/components/shared/page-layout"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { TableTextPreview } from "@/components/shared/table-text-preview"
import { SortableTableHead, TableFilterInput, type SortDirection } from "@/components/shared/table-tools"
import { useLiveRefresh } from "@/components/shared/use-live-refresh"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { hasFeatureAccess } from "@/lib/auth/permissions"
import {
  ETAPA_FLUXO_BADGE_CLASSES,
  ETAPA_FLUXO_LABELS,
  getEtapaFluxoLabel,
  shouldShowCompraStatusBadge,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/domain"
import type { Compra, EtapaFluxoCompra } from "@/lib/types"

type SortColumn = "solicitacao" | "cliente" | "solicitante" | "fornecedor" | "atualizado"

export default function SolicitacoesPage() {
  const session = useCurrentSession()
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    solicitacao: "",
    cliente: "",
    solicitante: "",
    fornecedor: "",
    etapa: "todos",
    updatedFrom: "",
    updatedTo: "",
  })
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "atualizado",
    direction: "desc",
  })

  const canCreateSolicitacao = Boolean(session && hasFeatureAccess(session.perfil, "solicitacoes", session.features))
  const canViewAllSolicitacoes = session?.perfil === "admin"

  async function fetchSolicitacoes(options: { silent?: boolean } = {}) {
    const { silent = false } = options

    try {
      if (!silent) {
        setLoading(true)
      }
      const response = await fetch("/api/solicitacoes", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Erro ao carregar solicitacoes.")
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
    void fetchSolicitacoes()
  }, [])

  useLiveRefresh(() => fetchSolicitacoes({ silent: true }), {
    enabled: true,
    intervalMs: 12000,
  })

  const filteredCompras = useMemo(() => {
    return [...compras]
      .filter((compra) => {
        const matchesSolicitacao =
          !filters.solicitacao ||
          `#${compra.id}`.toLowerCase().includes(filters.solicitacao.toLowerCase()) ||
          (compra.proposta_nome ?? "").toLowerCase().includes(filters.solicitacao.toLowerCase())

        const matchesCliente =
          !filters.cliente || (compra.cliente_nome ?? "").toLowerCase().includes(filters.cliente.toLowerCase())

        const matchesSolicitante =
          !filters.solicitante || (compra.solicitado_por ?? "").toLowerCase().includes(filters.solicitante.toLowerCase())

        const matchesFornecedor =
          !filters.fornecedor ||
          compra.fornecedor.toLowerCase().includes(filters.fornecedor.toLowerCase()) ||
          compra.descricao.toLowerCase().includes(filters.fornecedor.toLowerCase())

        const matchesEtapa = filters.etapa === "todos" || compra.etapa_fluxo === filters.etapa
        const matchesUpdatedFrom = !filters.updatedFrom || compra.updated_at.slice(0, 10) >= filters.updatedFrom
        const matchesUpdatedTo = !filters.updatedTo || compra.updated_at.slice(0, 10) <= filters.updatedTo

        return (
          matchesSolicitacao &&
          matchesCliente &&
          matchesSolicitante &&
          matchesFornecedor &&
          matchesEtapa &&
          matchesUpdatedFrom &&
          matchesUpdatedTo
        )
      })
      .sort((left, right) => sortCompras(left, right, sort))
  }, [compras, filters, sort])
  const comprasEnviadas = useMemo(() => {
    if (canViewAllSolicitacoes) {
      return filteredCompras
    }

    return filteredCompras.filter((compra) => isSolicitacaoOwnedByCurrentUser(compra, session?.userId, session?.nome))
  }, [canViewAllSolicitacoes, filteredCompras, session?.nome, session?.userId])

  const comprasAtualizadas = useMemo(() => {
    if (canViewAllSolicitacoes) {
      return filteredCompras.filter(
        (compra) =>
          compra.etapa_fluxo !== "solicitacao_registrada" &&
          compra.etapa_fluxo !== "cotacao_em_andamento",
      )
    }

    return filteredCompras.filter((compra) => {
      if (!isSolicitacaoOwnedByCurrentUser(compra, session?.userId, session?.nome)) {
        return false
      }

      return (
        compra.etapa_fluxo !== "solicitacao_registrada" &&
        compra.etapa_fluxo !== "cotacao_em_andamento"
      )
    })
  }, [canViewAllSolicitacoes, filteredCompras, session?.nome, session?.userId])

  const enviadasPagination = useListPagination(comprasEnviadas, {
    storageKey: "solicitacoes-enviadas-page-size",
    resetKey: JSON.stringify(filters),
  })
  const atualizacoesPagination = useListPagination(comprasAtualizadas, {
    storageKey: "solicitacoes-atualizadas-page-size",
    resetKey: JSON.stringify(filters),
  })

  const resumo = useMemo(
    () => ({
      total: filteredCompras.length,
      enviadas: comprasEnviadas.length,
      emCotacao: filteredCompras.filter((compra) =>
        ["solicitacao_registrada", "cotacao_em_andamento", "retificacao"].includes(compra.etapa_fluxo),
      ).length,
      emAutorizacao: filteredCompras.filter((compra) =>
        ["aguardando_admin", "aprovada_admin", "aguardando_financeiro", "liberada_para_fornecedor"].includes(
          compra.etapa_fluxo,
        ),
      ).length,
      concluidas: filteredCompras.filter((compra) => compra.status === "pedido_autorizado").length,
    }),
    [comprasEnviadas.length, filteredCompras],
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
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Solicitacoes"
        description="Registre pedidos de compra para o setor de compras e acompanhe as atualizacoes do andamento dessas solicitacoes."
        actions={
          canCreateSolicitacao ? (
            <Link href="/solicitacoes/novo">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova solicitacao
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard
          title={canViewAllSolicitacoes ? "Solicitacoes registradas" : "Pedidos enviados"}
          value={resumo.enviadas}
          description={canViewAllSolicitacoes ? "Solicitacoes que nasceram neste modulo" : "Solicitacoes enviadas por voce ao setor de compras"}
        />
        <SummaryMetricCard title="Em cotacao" value={resumo.emCotacao} description="Pedidos ainda em cotacao ou aguardando retorno do compras" />
        <SummaryMetricCard
          title="Em autorizacao"
          value={resumo.emAutorizacao}
          description="Pedidos que ja receberam cotacao e avancaram para as aprovacoes internas."
        />
        <SummaryMetricCard
          title="Concluidas"
          value={resumo.concluidas}
          description="Pedidos que ja chegaram a conclusao operacional da compra."
        />
      </div>

      <SectionCard
        title="Filtros da area"
        description="Use os filtros para localizar os pedidos enviados e acompanhar as atualizacoes recebidas do setor de compras."
      >
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
          <ListFilterGrid columns={`grid gap-3 md:grid-cols-2 ${canViewAllSolicitacoes ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
            <ListFilterField label="Solicitacao">
              <TableFilterInput
                value={filters.solicitacao}
                onChange={(value) => setFilters((current) => ({ ...current, solicitacao: value }))}
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

            {canViewAllSolicitacoes ? (
              <ListFilterField label="Solicitante">
                <TableFilterInput
                  value={filters.solicitante}
                  onChange={(value) => setFilters((current) => ({ ...current, solicitante: value }))}
                  placeholder="Filtrar solicitante"
                />
              </ListFilterField>
            ) : null}

            <ListFilterField label="Fornecedor ou material">
              <TableFilterInput
                value={filters.fornecedor}
                onChange={(value) => setFilters((current) => ({ ...current, fornecedor: value }))}
                placeholder="Fornecedor ou material"
              />
            </ListFilterField>

            <ListFilterField label="Etapa">
              <Select value={filters.etapa} onValueChange={(value) => setFilters((current) => ({ ...current, etapa: value }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {ETAPA_FILTER_OPTIONS.map((etapa) => (
                    <SelectItem key={etapa} value={etapa}>
                      {ETAPA_FLUXO_LABELS[etapa]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ListFilterField>
          </ListFilterGrid>
        </ListFilterPanel>
      </SectionCard>

      <SectionCard
        title={canViewAllSolicitacoes ? "Solicitacoes registradas" : "Pedidos enviados ao setor de compras"}
        description={
          canViewAllSolicitacoes
            ? `${comprasEnviadas.length} solicitacao(oes) registradas neste modulo`
            : `${comprasEnviadas.length} pedido(s) enviados por voce para acompanhamento`
        }
      >
        {comprasEnviadas.length === 0 ? (
          <div className="space-y-4 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <p>Nenhuma solicitacao encontrada para os filtros atuais.</p>
            {canCreateSolicitacao ? (
              <Link href="/solicitacoes/novo">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar nova solicitacao
                </Button>
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
                        label="Solicitacao"
                        isActive={sort.column === "solicitacao"}
                        direction={sort.direction}
                        onClick={() => toggleSort("solicitacao")}
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
                    {canViewAllSolicitacoes ? (
                      <TableHead>
                        <SortableTableHead
                          label="Solicitante"
                          isActive={sort.column === "solicitante"}
                          direction={sort.direction}
                          onClick={() => toggleSort("solicitante")}
                        />
                      </TableHead>
                    ) : null}
                    <TableHead>
                      <SortableTableHead
                        label="Fornecedor"
                        isActive={sort.column === "fornecedor"}
                        direction={sort.direction}
                        onClick={() => toggleSort("fornecedor")}
                      />
                    </TableHead>
                    <TableHead>Situacao</TableHead>
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
                  {enviadasPagination.items.map((compra) => {
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
                        {canViewAllSolicitacoes ? (
                          <TableCell>
                            <TableTextPreview text={compra.solicitado_por} fallback="Nao informado" className="max-w-[180px]" />
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <div className="space-y-1">
                            <div>{compra.fornecedor}</div>
                            <TableTextPreview text={compra.descricao} className="max-w-[220px]" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>
                              {getEtapaFluxoLabel(compra)}
                            </Badge>
                            {shouldShowCompraStatusBadge(compra) ? (
                              <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell className="text-right">
                          <RowActionsMenu label={`Acoes da solicitacao ${compra.id}`}>
                            <DropdownMenuItem asChild>
                              <Link href={`/solicitacoes/${compra.id}`}>
                                <Eye className="h-4 w-4" />
                                Abrir solicitacao
                              </Link>
                            </DropdownMenuItem>
                          </RowActionsMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <ListPaginationBar
              currentPage={enviadasPagination.currentPage}
              endItem={enviadasPagination.endItem}
              itemLabel="solicitacao(oes)"
              onPageChange={enviadasPagination.setPage}
              onPageSizeChange={enviadasPagination.setPageSize}
              pageSize={enviadasPagination.pageSize}
              startItem={enviadasPagination.startItem}
              totalItems={enviadasPagination.totalItems}
              totalPages={enviadasPagination.totalPages}
            />
          </>
        )}
      </SectionCard>

      <SectionCard
        title={canViewAllSolicitacoes ? "Atualizacoes das solicitacoes" : "Atualizacoes das suas solicitacoes"}
        description={
          canViewAllSolicitacoes
            ? `${comprasAtualizadas.length} pedido(s) com cotacao ou autorizacao em andamento`
            : `${comprasAtualizadas.length} pedido(s) que receberam atualizacao do setor de compras`
        }
      >
        {comprasAtualizadas.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            Nenhuma atualizacao encontrada para os filtros atuais.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortableTableHead
                        label="Solicitacao"
                        isActive={sort.column === "solicitacao"}
                        direction={sort.direction}
                        onClick={() => toggleSort("solicitacao")}
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
                    {canViewAllSolicitacoes ? (
                      <TableHead>
                        <SortableTableHead
                          label="Solicitante"
                          isActive={sort.column === "solicitante"}
                          direction={sort.direction}
                          onClick={() => toggleSort("solicitante")}
                        />
                      </TableHead>
                    ) : null}
                    <TableHead>
                      <SortableTableHead
                        label="Fornecedor"
                        isActive={sort.column === "fornecedor"}
                        direction={sort.direction}
                        onClick={() => toggleSort("fornecedor")}
                      />
                    </TableHead>
                    <TableHead>Situacao</TableHead>
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
                  {atualizacoesPagination.items.map((compra) => {
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
                        {canViewAllSolicitacoes ? (
                          <TableCell>
                            <TableTextPreview text={compra.solicitado_por} fallback="Nao informado" className="max-w-[180px]" />
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <div className="space-y-1">
                            <div>{compra.fornecedor}</div>
                            <TableTextPreview text={compra.descricao} className="max-w-[220px]" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>
                              {getEtapaFluxoLabel(compra)}
                            </Badge>
                            {shouldShowCompraStatusBadge(compra) ? (
                              <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell className="text-right">
                          <RowActionsMenu label={`Acoes da solicitacao ${compra.id}`}>
                            <DropdownMenuItem asChild>
                              <Link href={`/solicitacoes/${compra.id}`}>
                                <Eye className="h-4 w-4" />
                                Abrir solicitacao
                              </Link>
                            </DropdownMenuItem>
                          </RowActionsMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <ListPaginationBar
              currentPage={atualizacoesPagination.currentPage}
              endItem={atualizacoesPagination.endItem}
              itemLabel="solicitacao(oes)"
              onPageChange={atualizacoesPagination.setPage}
              onPageSizeChange={atualizacoesPagination.setPageSize}
              pageSize={atualizacoesPagination.pageSize}
              startItem={atualizacoesPagination.startItem}
              totalItems={atualizacoesPagination.totalItems}
              totalPages={atualizacoesPagination.totalPages}
            />
          </>
        )}
      </SectionCard>
    </div>
  )
}

function sortCompras(
  left: Compra,
  right: Compra,
  sort: { column: SortColumn; direction: SortDirection },
) {
  const modifier = sort.direction === "asc" ? 1 : -1

  switch (sort.column) {
    case "solicitacao":
      return (`#${left.id}`.localeCompare(`#${right.id}`, "pt-BR")) * modifier
    case "cliente":
      return ((left.cliente_nome ?? "").localeCompare(right.cliente_nome ?? "", "pt-BR")) * modifier
    case "solicitante":
      return ((left.solicitado_por ?? "").localeCompare(right.solicitado_por ?? "", "pt-BR")) * modifier
    case "fornecedor":
      return left.fornecedor.localeCompare(right.fornecedor, "pt-BR") * modifier
    case "atualizado":
    default:
      return (new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()) * modifier
  }
}

function isSolicitacaoOwnedByCurrentUser(compra: Compra, userId?: number, nome?: string) {
  const normalizedName = nome?.trim().toLowerCase()

  if (userId && compra.solicitante_id === userId) {
    return true
  }

  return Boolean(normalizedName && compra.solicitado_por?.trim().toLowerCase() === normalizedName)
}

const ETAPA_FILTER_OPTIONS: EtapaFluxoCompra[] = [
  "solicitacao_registrada",
  "cotacao_em_andamento",
  "retificacao",
  "aguardando_admin",
  "aprovada_admin",
  "aguardando_financeiro",
  "liberada_para_fornecedor",
  "pedido_autorizado",
]
