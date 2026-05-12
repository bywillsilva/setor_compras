"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Clock, Eye, Loader2 } from "lucide-react"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ListPaginationBar, useListPagination } from "@/components/shared/list-pagination"
import { ListFilterField, ListFilterGrid, ListFilterPanel } from "@/components/shared/list-filter-panel"
import { PageHeader, SectionCard } from "@/components/shared/page-layout"
import { TableTextPreview } from "@/components/shared/table-text-preview"
import { SortableTableHead, TableFilterInput, type SortDirection } from "@/components/shared/table-tools"
import { useLiveRefresh } from "@/components/shared/use-live-refresh"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/domain"
import type { HistoricoReportItem } from "@/lib/types"

type SortColumn = "data" | "cliente" | "fornecedor" | "usuario"

export default function AtualizacoesPage() {
  const [updates, setUpdates] = useState<HistoricoReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: "",
    dateFrom: "",
    dateTo: "",
  })
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "data",
    direction: "desc",
  })

  async function fetchUpdates(options: { silent?: boolean } = {}) {
    const { silent = false } = options

    try {
      if (!silent) {
        setLoading(true)
      }

      const params = new URLSearchParams()
      if (filters.search.trim()) {
        params.set("search", filters.search.trim())
      }
      if (filters.dateFrom) {
        params.set("dateFrom", filters.dateFrom)
      }
      if (filters.dateTo) {
        params.set("dateTo", filters.dateTo)
      }

      const query = params.toString()
      const response = await fetch(`/api/atualizacoes${query ? `?${query}` : ""}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao carregar atualizacoes.")
      }

      setUpdates(Array.isArray(payload) ? payload : [])
    } catch (error) {
      if (!silent) {
        alert(error instanceof Error ? error.message : "Erro ao carregar atualizacoes.")
      }
      setUpdates([])
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void fetchUpdates()
  }, [filters.search, filters.dateFrom, filters.dateTo])

  useLiveRefresh(() => fetchUpdates({ silent: true }), {
    intervalMs: 15000,
  })

  const sortedUpdates = useMemo(() => {
    return [...updates].sort((left, right) => {
      if (sort.column === "data") {
        const leftValue = parseISO(left.data).getTime()
        const rightValue = parseISO(right.data).getTime()
        return sort.direction === "asc" ? leftValue - rightValue : rightValue - leftValue
      }

      if (sort.column === "cliente") {
        const result = `${left.cliente_nome} ${left.proposta_nome}`.localeCompare(`${right.cliente_nome} ${right.proposta_nome}`, "pt-BR")
        return sort.direction === "asc" ? result : -result
      }

      if (sort.column === "fornecedor") {
        const result = left.fornecedor.localeCompare(right.fornecedor, "pt-BR")
        return sort.direction === "asc" ? result : -result
      }

      const result = left.usuario.localeCompare(right.usuario, "pt-BR")
      return sort.direction === "asc" ? result : -result
    })
  }, [sort, updates])
  const pagination = useListPagination(sortedUpdates, {
    storageKey: "atualizacoes-page-size",
    resetKey: JSON.stringify(filters),
  })

  function toggleSort(column: SortColumn) {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === "asc" ? "desc" : "asc",
    }))
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Atualizacoes recentes"
        description="Acompanhe todas as movimentacoes registradas no sistema, com data, responsavel e pedido relacionado."
        actions={
          <Button asChild variant="outline">
            <Link href="/">Voltar ao dashboard</Link>
          </Button>
        }
      />

      <SectionCard title="Historico do sistema" description={`${sortedUpdates.length} atualizacao(oes) nesta visao`}>
        <ListFilterPanel
          trailing={
            <DateRangeFilter
              startDate={filters.dateFrom}
              endDate={filters.dateTo}
              onStartDateChange={(value) => setFilters((current) => ({ ...current, dateFrom: value }))}
              onEndDateChange={(value) => setFilters((current) => ({ ...current, dateTo: value }))}
              onClear={() => setFilters((current) => ({ ...current, dateFrom: "", dateTo: "" }))}
              startLabel="De"
              endLabel="Ate"
            />
          }
        >
          <ListFilterGrid columns="grid gap-3 md:grid-cols-1 xl:grid-cols-1">
            <ListFilterField label="Buscar">
              <TableFilterInput
                value={filters.search}
                onChange={(value) => setFilters((current) => ({ ...current, search: value }))}
                placeholder="Pedido, cliente, proposta, fornecedor, evento ou responsavel"
              />
            </ListFilterField>
          </ListFilterGrid>
        </ListFilterPanel>

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : sortedUpdates.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
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
                        label="Movimentacao"
                        isActive={sort.column === "data"}
                        direction={sort.direction}
                        onClick={() => toggleSort("data")}
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
                    <TableHead>Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Responsavel"
                        isActive={sort.column === "usuario"}
                        direction={sort.direction}
                        onClick={() => toggleSort("usuario")}
                      />
                    </TableHead>
                    <TableHead className="text-right">Acao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">#{item.compra_id}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(parseISO(item.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(parseISO(item.data), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[220px] space-y-1">
                          <div className="font-medium">{item.cliente_nome}</div>
                          <TableTextPreview text={item.proposta_nome} className="max-w-[220px]" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <TableTextPreview text={item.fornecedor} className="max-w-[180px]" />
                      </TableCell>
                      <TableCell>
                        <TableTextPreview text={item.evento} className="max-w-[320px]" />
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE_CLASSES[item.compra_status]}>{STATUS_LABELS[item.compra_status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{item.usuario}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/compras/${item.compra_id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Abrir pedido
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ListPaginationBar
              currentPage={pagination.currentPage}
              endItem={pagination.endItem}
              itemLabel="atualizacao(oes)"
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
