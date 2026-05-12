"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Eye, FilePlus2, Loader2 } from "lucide-react"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ListPaginationBar, useListPagination } from "@/components/shared/list-pagination"
import { ListFilterField, ListFilterGrid, ListFilterPanel } from "@/components/shared/list-filter-panel"
import { PageHeader, SectionCard, SummaryMetricCard } from "@/components/shared/page-layout"
import { TableTextPreview } from "@/components/shared/table-text-preview"
import { SortableTableHead, TableFilterInput, type SortDirection } from "@/components/shared/table-tools"
import { useLiveRefresh } from "@/components/shared/use-live-refresh"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ResumoContrato } from "@/lib/types"

type SortColumn = "titulo" | "periodo" | "lucro" | "atualizado"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatPeriodo(periodo: string) {
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    return periodo
  }

  const [year, month] = periodo.split("-")
  return format(new Date(Number(year), Number(month) - 1, 1), "MMMM 'de' yyyy", { locale: ptBR })
}

export default function ResumoContratosPage() {
  const [items, setItems] = useState<ResumoContrato[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: "",
    dateFrom: "",
    dateTo: "",
  })
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "atualizado",
    direction: "desc",
  })

  async function fetchData(options: { silent?: boolean } = {}) {
    const { silent = false } = options

    try {
      if (!silent) {
        setLoading(true)
      }

      const response = await fetch("/api/resumo-contratos", { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao carregar resumos de contratos.")
      }

      setItems(Array.isArray(payload) ? payload : [])
    } catch (error) {
      if (!silent) {
        alert(error instanceof Error ? error.message : "Erro ao carregar resumos de contratos.")
      }
      setItems([])
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
    intervalMs: 20000,
  })

  const filteredItems = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase("pt-BR")
    return items.filter((item) => {
      if (search) {
        const haystack = `${item.titulo} ${item.created_by_nome} ${item.periodo_referencia}`.toLocaleLowerCase("pt-BR")
        if (!haystack.includes(search)) {
          return false
        }
      }

      if (filters.dateFrom && item.periodo_referencia < filters.dateFrom.slice(0, 7)) {
        return false
      }

      if (filters.dateTo && item.periodo_referencia > filters.dateTo.slice(0, 7)) {
        return false
      }

      return true
    })
  }, [filters.dateFrom, filters.dateTo, filters.search, items])

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((left, right) => {
      if (sort.column === "titulo") {
        const result = left.titulo.localeCompare(right.titulo, "pt-BR")
        return sort.direction === "asc" ? result : -result
      }

      if (sort.column === "periodo") {
        const result = left.periodo_referencia.localeCompare(right.periodo_referencia, "pt-BR")
        return sort.direction === "asc" ? result : -result
      }

      if (sort.column === "lucro") {
        const result = left.lucro_bruto_total - right.lucro_bruto_total
        return sort.direction === "asc" ? result : -result
      }

      const result = parseISO(left.updated_at).getTime() - parseISO(right.updated_at).getTime()
      return sort.direction === "asc" ? result : -result
    })
  }, [filteredItems, sort])

  const pagination = useListPagination(sortedItems, {
    storageKey: "resumo-contratos-page-size",
    resetKey: JSON.stringify(filters),
  })

  const overview = useMemo(() => {
    return sortedItems.reduce(
      (accumulator, item) => {
        accumulator.valor_total_contrato += item.valor_total_contrato
        accumulator.valor_total_real_gasto += item.valor_total_real_gasto
        accumulator.lucro_bruto_total += item.lucro_bruto_total
        accumulator.quantidade_obras += item.quantidade_obras
        return accumulator
      },
      {
        valor_total_contrato: 0,
        valor_total_real_gasto: 0,
        lucro_bruto_total: 0,
        quantidade_obras: 0,
      },
    )
  }, [sortedItems])

  function toggleSort(column: SortColumn) {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === "asc" ? "desc" : "asc",
    }))
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Resumo de Contratos"
        description="Monte seleções administrativas de obras para comparar contrato fechado, gasto real e lucro bruto."
        actions={
          <Button asChild>
            <Link href="/resumo-contratos/novo">
              <FilePlus2 className="mr-2 h-4 w-4" />
              Nova seleção
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <SummaryMetricCard title="Seleções" value={sortedItems.length} description="Agrupamentos salvos nesta visão." />
        <SummaryMetricCard title="Obras listadas" value={overview.quantidade_obras} description="Total de obras incluídas na visão atual." />
        <SummaryMetricCard title="Contrato total" value={formatCurrency(overview.valor_total_contrato)} description="Soma dos contratos informados nas seleções filtradas." />
        <SummaryMetricCard
          title="Lucro bruto total"
          value={formatCurrency(overview.lucro_bruto_total)}
          description="Diferença consolidada entre contrato e gasto real das obras filtradas."
          tone={overview.lucro_bruto_total < 0 ? "danger" : "default"}
        />
      </div>

      <SectionCard title="Seleções salvas" description={`${sortedItems.length} seleção(ões) nesta visão`}>
        <ListFilterPanel
          trailing={
            <DateRangeFilter
              startDate={filters.dateFrom}
              endDate={filters.dateTo}
              onStartDateChange={(value) => setFilters((current) => ({ ...current, dateFrom: value }))}
              onEndDateChange={(value) => setFilters((current) => ({ ...current, dateTo: value }))}
              onClear={() => setFilters((current) => ({ ...current, dateFrom: "", dateTo: "" }))}
            />
          }
        >
          <ListFilterGrid columns="grid gap-3 md:grid-cols-1 xl:grid-cols-1">
            <ListFilterField label="Buscar">
              <TableFilterInput
                value={filters.search}
                onChange={(value) => setFilters((current) => ({ ...current, search: value }))}
                placeholder="Título, período ou responsável"
              />
            </ListFilterField>
          </ListFilterGrid>
        </ListFilterPanel>

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Nenhuma seleção encontrada para os filtros atuais.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortableTableHead
                        label="Título"
                        isActive={sort.column === "titulo"}
                        direction={sort.direction}
                        onClick={() => toggleSort("titulo")}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Período"
                        isActive={sort.column === "periodo"}
                        direction={sort.direction}
                        onClick={() => toggleSort("periodo")}
                      />
                    </TableHead>
                    <TableHead>Obras</TableHead>
                    <TableHead>Contrato total</TableHead>
                    <TableHead>Gasto real</TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Lucro bruto"
                        isActive={sort.column === "lucro"}
                        direction={sort.direction}
                        onClick={() => toggleSort("lucro")}
                      />
                    </TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Atualizado"
                        isActive={sort.column === "atualizado"}
                        direction={sort.direction}
                        onClick={() => toggleSort("atualizado")}
                      />
                    </TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{item.titulo}</div>
                          <TableTextPreview text={`Seleção #${item.id}`} className="max-w-[220px]" />
                        </div>
                      </TableCell>
                      <TableCell>{formatPeriodo(item.periodo_referencia)}</TableCell>
                      <TableCell>{item.quantidade_obras}</TableCell>
                      <TableCell>{formatCurrency(item.valor_total_contrato)}</TableCell>
                      <TableCell>{formatCurrency(item.valor_total_real_gasto)}</TableCell>
                      <TableCell className={item.lucro_bruto_total < 0 ? "text-red-500 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"}>
                        {formatCurrency(item.lucro_bruto_total)}
                      </TableCell>
                      <TableCell>{item.created_by_nome}</TableCell>
                      <TableCell>{format(parseISO(item.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/resumo-contratos/${item.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalhes
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
              itemLabel="seleção(ões)"
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
