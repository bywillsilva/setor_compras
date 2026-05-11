"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Eye, Truck } from "lucide-react"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ListFilterField, ListFilterGrid, ListFilterPanel } from "@/components/shared/list-filter-panel"
import { PageHeader, SectionCard, SummaryMetricCard } from "@/components/shared/page-layout"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { TableTextPreview } from "@/components/shared/table-text-preview"
import { SortableTableHead, TableFilterInput, type SortDirection } from "@/components/shared/table-tools"
import { useLiveRefresh } from "@/components/shared/use-live-refresh"
import { DeliveryStatusBadge } from "@/components/compras/delivery-status-badge"
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
import { getDeliverySituation } from "@/lib/domain"
import type { Cliente, Compra } from "@/lib/types"

type SortColumn = "pedido" | "cliente" | "fornecedor" | "previsao"

export default function EntregasPage() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    pedido: "",
    cliente: "todos",
    fornecedor: "",
    situacao: "todos",
    previsaoFrom: "",
    previsaoTo: "",
  })
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "previsao",
    direction: "asc",
  })

  async function fetchData() {
    try {
      setLoading(true)
      const [comprasResponse, clientesResponse] = await Promise.all([
        fetch("/api/compras?status=pedido_autorizado", { cache: "no-store" }),
        fetch("/api/clientes", { cache: "no-store" }),
      ])

      if (comprasResponse.ok) {
        setCompras(await comprasResponse.json())
      }

      if (clientesResponse.ok) {
        setClientes(await clientesResponse.json())
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [])

  useLiveRefresh(fetchData, { intervalMs: 12000 })

  const metrics = useMemo(
    () => ({
      total: compras.length,
      entregues: compras.filter((compra) => compra.status_entrega === "entregue").length,
      atrasados: compras.filter((compra) => getDeliverySituation(compra) === "atrasado").length,
      proximos: compras.filter((compra) => getDeliverySituation(compra) === "proximo").length,
    }),
    [compras],
  )

  const filteredCompras = useMemo(() => {
    return [...compras]
      .filter((compra) => {
        const situacao = getDeliverySituation(compra)
        const matchesPedido =
          !filters.pedido ||
          `#${compra.id}`.toLowerCase().includes(filters.pedido.toLowerCase()) ||
          (compra.numero_pedido ?? "").toLowerCase().includes(filters.pedido.toLowerCase())
        const matchesCliente = filters.cliente === "todos" || compra.cliente_id.toString() === filters.cliente
        const matchesFornecedor =
          !filters.fornecedor ||
          compra.fornecedor.toLowerCase().includes(filters.fornecedor.toLowerCase()) ||
          compra.proposta_nome?.toLowerCase().includes(filters.fornecedor.toLowerCase()) ||
          compra.descricao.toLowerCase().includes(filters.fornecedor.toLowerCase())
        const matchesSituacao = filters.situacao === "todos" || situacao === filters.situacao
        const referenceDate = compra.previsao_entrega ?? compra.data_criacao
        const matchesPrevisaoFrom = !filters.previsaoFrom || referenceDate >= filters.previsaoFrom
        const matchesPrevisaoTo = !filters.previsaoTo || referenceDate <= filters.previsaoTo

        return (
          matchesPedido &&
          matchesCliente &&
          matchesFornecedor &&
          matchesSituacao &&
          matchesPrevisaoFrom &&
          matchesPrevisaoTo
        )
      })
      .sort((left, right) => sortCompras(left, right, sort))
  }, [compras, filters, sort])

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
        title="Entregas"
        description="Gerencie previsao, pendencias e confirmacao de entrega sem misturar com a fase de autorizacao."
        actions={
          <Link href="/compras">
            <Button variant="outline">Voltar para compras</Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryMetricCard title="Autorizados" value={metrics.total} description="Pedidos liberados para entrega" />
        <SummaryMetricCard title="Entregues" value={metrics.entregues} description="Pedidos encerrados" />
        <SummaryMetricCard title="Atrasados" value={metrics.atrasados} description="Entregas fora do prazo" tone="danger" />
        <SummaryMetricCard title="Proximos" value={metrics.proximos} description="Entregas perto do vencimento" tone="warning" />
      </div>

      <SectionCard title="Controle de entregas" description={`${filteredCompras.length} pedido(s) em acompanhamento`}>
        <ListFilterPanel
          trailing={
            <DateRangeFilter
              startDate={filters.previsaoFrom}
              endDate={filters.previsaoTo}
              onStartDateChange={(value) => setFilters((current) => ({ ...current, previsaoFrom: value }))}
              onEndDateChange={(value) => setFilters((current) => ({ ...current, previsaoTo: value }))}
              onClear={() => setFilters((current) => ({ ...current, previsaoFrom: "", previsaoTo: "" }))}
              startLabel="Previsao de"
              endLabel="Previsao ate"
            />
          }
        >
          <ListFilterGrid columns="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ListFilterField label="Pedido">
              <TableFilterInput
                value={filters.pedido}
                onChange={(value) => setFilters((current) => ({ ...current, pedido: value }))}
                placeholder="ID ou numero"
              />
            </ListFilterField>

            <ListFilterField label="Cliente">
              <Select value={filters.cliente} onValueChange={(value) => setFilters((current) => ({ ...current, cliente: value }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id.toString()}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ListFilterField>

            <ListFilterField label="Fornecedor ou material">
              <TableFilterInput
                value={filters.fornecedor}
                onChange={(value) => setFilters((current) => ({ ...current, fornecedor: value }))}
                placeholder="Fornecedor ou material"
              />
            </ListFilterField>

            <ListFilterField label="Situacao">
              <Select value={filters.situacao} onValueChange={(value) => setFilters((current) => ({ ...current, situacao: value }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="proximo">Proximo</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="no_prazo">No prazo</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                </SelectContent>
              </Select>
            </ListFilterField>
          </ListFilterGrid>
        </ListFilterPanel>
        {filteredCompras.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            Nenhum pedido autorizado encontrado para acompanhamento.
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
                      label="Fornecedor"
                      isActive={sort.column === "fornecedor"}
                      direction={sort.direction}
                      onClick={() => toggleSort("fornecedor")}
                    />
                  </TableHead>
                  <TableHead>Situacao</TableHead>
                  <TableHead>Status entrega</TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Previsao"
                      isActive={sort.column === "previsao"}
                      direction={sort.direction}
                      onClick={() => toggleSort("previsao")}
                    />
                  </TableHead>
                  <TableHead>Data real</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompras.map((compra) => (
                  <TableRow key={compra.id}>
                    <TableCell className="font-mono text-sm">#{compra.id}</TableCell>
                    <TableCell className="font-medium">{compra.cliente_nome}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div>{compra.fornecedor}</div>
                        <TableTextPreview
                          text={compra.proposta_nome}
                          fallback="Sem proposta"
                          className="max-w-[190px]"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <DeliveryStatusBadge compra={compra} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{compra.status_entrega === "entregue" ? "Entregue" : "Pendente"}</Badge>
                    </TableCell>
                    <TableCell>
                      {compra.previsao_entrega ? format(parseISO(compra.previsao_entrega), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                    </TableCell>
                    <TableCell>
                      {compra.data_entrega_real ? format(parseISO(compra.data_entrega_real), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActionsMenu label={`Acoes de entrega do pedido ${compra.id}`}>
                        <DropdownMenuItem asChild>
                          <Link href={`/compras/${compra.id}`}>
                            <Eye className="h-4 w-4" />
                            Ver pedido
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/entregas/${compra.id}`}>
                            <Truck className="h-4 w-4" />
                            {compra.status_entrega === "entregue" ? "Revisar entrega" : "Informar entrega"}
                          </Link>
                        </DropdownMenuItem>
                      </RowActionsMenu>
                    </TableCell>
                  </TableRow>
                ))}
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
    case "fornecedor":
      return left.fornecedor.localeCompare(right.fornecedor, "pt-BR") * modifier
    case "previsao":
    default:
      return ((left.previsao_entrega ?? "9999-12-31").localeCompare(right.previsao_entrega ?? "9999-12-31")) * modifier
  }
}
