"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle2, Eye } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ListFilterField, ListFilterGrid, ListFilterPanel } from "@/components/shared/list-filter-panel"
import { PageHeader, SectionCard, SummaryMetricCard } from "@/components/shared/page-layout"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { SortableTableHead, TableFilterInput, type SortDirection } from "@/components/shared/table-tools"
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
import { hasFeatureAccess } from "@/lib/auth/permissions"
import {
  CATEGORIA_LABELS,
  ETAPA_FLUXO_BADGE_CLASSES,
  ETAPA_FLUXO_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/domain"
import type { Cliente, Compra } from "@/lib/types"

type SortColumn = "pedido" | "cliente" | "fornecedor" | "atualizado"

export default function SolicitacoesAutorizacaoPage() {
  const session = useCurrentSession()
  const [compras, setCompras] = useState<Compra[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    pedido: "",
    cliente: "todos",
    fornecedor: "",
    status: "todos",
    updatedFrom: "",
    updatedTo: "",
  })
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "atualizado",
    direction: "desc",
  })
  const canViewCompras = Boolean(session && hasFeatureAccess(session.perfil, "compras", session.features))

  async function fetchData() {
    try {
      setLoading(true)
      const [comprasResponse, clientesResponse] = await Promise.all([fetch("/api/compras"), fetch("/api/clientes")])

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

  const filteredCompras = useMemo(() => {
    return compras
      .filter((compra) => compra.etapa_fluxo === "aguardando_admin")
      .filter((compra) => {
        const matchesPedido =
          !filters.pedido ||
          `#${compra.id}`.toLowerCase().includes(filters.pedido.toLowerCase()) ||
          (compra.proposta_nome ?? "").toLowerCase().includes(filters.pedido.toLowerCase())
        const matchesCliente = filters.cliente === "todos" || compra.cliente_id.toString() === filters.cliente
        const matchesFornecedor =
          !filters.fornecedor ||
          compra.fornecedor.toLowerCase().includes(filters.fornecedor.toLowerCase()) ||
          compra.descricao.toLowerCase().includes(filters.fornecedor.toLowerCase())
        const matchesStatus = filters.status === "todos" || compra.status === filters.status
        const matchesUpdatedFrom = !filters.updatedFrom || compra.updated_at.slice(0, 10) >= filters.updatedFrom
        const matchesUpdatedTo = !filters.updatedTo || compra.updated_at.slice(0, 10) <= filters.updatedTo

        return (
          matchesPedido &&
          matchesCliente &&
          matchesFornecedor &&
          matchesStatus &&
          matchesUpdatedFrom &&
          matchesUpdatedTo
        )
      })
      .sort((left, right) => sortCompras(left, right, sort))
  }, [compras, filters, sort])

  const resumo = useMemo(
    () => ({
      clientesEnvolvidos: new Set(filteredCompras.map((compra) => compra.cliente_id)).size,
      solicitadas: filteredCompras.length,
      comNumeroPendente: filteredCompras.filter((compra) => !compra.numero_pedido).length,
      comValorPendente: filteredCompras.filter((compra) => !compra.valor_total).length,
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
        title="Aprovacao ADM"
        description="Pedidos aprovados pelo solicitante e aguardando a liberacao do administrativo."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryMetricCard title="Na fila ADM" value={resumo.solicitadas} description="Aguardando numero e valor autorizado" />
        <SummaryMetricCard title="Numero pendente" value={resumo.comNumeroPendente} description="Pedidos sem numero registrado" />
        <SummaryMetricCard title="Valor pendente" value={resumo.comValorPendente} description="Pedidos sem valor autorizado" />
        <SummaryMetricCard title="Clientes" value={resumo.clientesEnvolvidos} description="Clientes com pedidos na fila" />
      </div>

      <SectionCard title="Fila do administrador" description={`${filteredCompras.length} pedido(s) aguardando aprovacao administrativa`}>
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
          <ListFilterGrid columns="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ListFilterField label="Pedido">
              <TableFilterInput
                value={filters.pedido}
                onChange={(value) => setFilters((current) => ({ ...current, pedido: value }))}
                placeholder="ID ou proposta"
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

            <ListFilterField label="Status">
              <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="cotacao">Cotacao</SelectItem>
                  <SelectItem value="em_analise">Em analise</SelectItem>
                  <SelectItem value="retificacao">Retificacao</SelectItem>
                </SelectContent>
              </Select>
            </ListFilterField>
          </ListFilterGrid>
        </ListFilterPanel>
        {filteredCompras.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            Nenhum pedido pendente de autorizacao no momento.
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
                  <TableHead>Status</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>
                    <SortableTableHead
                      label="Atualizado em"
                      isActive={sort.column === "atualizado"}
                      direction={sort.direction}
                      onClick={() => toggleSort("atualizado")}
                    />
                  </TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompras.map((compra) => (
                  <TableRow key={compra.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-mono text-sm font-medium">#{compra.id}</div>
                        <div className="text-xs text-muted-foreground">{compra.proposta_nome}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{compra.cliente_nome}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div>{compra.fornecedor}</div>
                        <Badge variant="outline">{CATEGORIA_LABELS[compra.categoria]}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>
                        {ETAPA_FLUXO_LABELS[compra.etapa_fluxo]}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell className="text-right">
                      <RowActionsMenu label={`Acoes da solicitacao ${compra.id}`}>
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
                        <DropdownMenuItem asChild>
                          <Link href={`/solicitacoes-autorizacao/${compra.id}`}>
                            <CheckCircle2 className="h-4 w-4" />
                            Autorizar pedido
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
    case "atualizado":
    default:
      return (new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()) * modifier
  }
}
