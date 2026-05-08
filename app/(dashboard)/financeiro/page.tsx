"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { BadgeDollarSign, CheckCircle2, Eye, Loader2 } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ListFilterField, ListFilterGrid, ListFilterPanel } from "@/components/shared/list-filter-panel"
import { PageHeader, SectionCard, SummaryMetricCard } from "@/components/shared/page-layout"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { SortableTableHead, TableFilterInput, type SortDirection } from "@/components/shared/table-tools"
import { Badge } from "@/components/ui/badge"
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
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/domain"
import type { Compra } from "@/lib/types"

type SortColumn = "pedido" | "cliente" | "valor" | "atualizado"

export default function FinanceiroPage() {
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
  const canViewCompras = Boolean(session && hasFeatureAccess(session.perfil, "compras", session.features))

  async function fetchData() {
    try {
      setLoading(true)
      const response = await fetch("/api/compras")
      if (!response.ok) {
        throw new Error("Erro ao carregar fila financeira.")
      }

      setCompras(await response.json())
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [])

  async function runAction(compraId: number, path: string, successMessage: string, body?: Record<string, unknown>) {
    setProcessingId(compraId)

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao atualizar fila financeira.")
      }

      alert(successMessage)
      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar fila financeira.")
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
        const matchesEtapa =
          filters.etapa === "todos" ||
          (filters.etapa === "aguardando_financeiro" && compra.etapa_fluxo === "aguardando_financeiro") ||
          (filters.etapa === "documentos" &&
            compra.status === "pedido_autorizado" &&
            compra.possui_nf &&
            compra.possui_boleto &&
            !compra.documentos_financeiro_confirmados_em)
        const matchesUpdatedFrom = !filters.updatedFrom || compra.updated_at.slice(0, 10) >= filters.updatedFrom
        const matchesUpdatedTo = !filters.updatedTo || compra.updated_at.slice(0, 10) <= filters.updatedTo

        return matchesPedido && matchesCliente && matchesEtapa && matchesUpdatedFrom && matchesUpdatedTo
      })
      .sort((left, right) => sortCompras(left, right, sort))
  }, [compras, filters, sort])

  const comprasAguardandoAprovacao = filteredCompras.filter((compra) => compra.etapa_fluxo === "aguardando_financeiro")
  const comprasAguardandoDocumentos = filteredCompras.filter(
    (compra) =>
      compra.status === "pedido_autorizado" &&
      compra.possui_nf &&
      compra.possui_boleto &&
      !compra.documentos_financeiro_confirmados_em,
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
        title="Financeiro"
        description="Aprove a liberacao financeira e confirme depois o registro interno de nota fiscal e boleto."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryMetricCard
          title="Aprovacoes financeiras"
          value={comprasAguardandoAprovacao.length}
          description="Pedidos aguardando sua liberacao"
        />
        <SummaryMetricCard
          title="Baixas pendentes"
          value={comprasAguardandoDocumentos.length}
          description="Pedidos com NF e boleto prontos para registrar"
        />
      </div>

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
              placeholder="ID ou numero"
            />
          </ListFilterField>

          <ListFilterField label="Cliente ou proposta">
            <TableFilterInput
              value={filters.cliente}
              onChange={(value) => setFilters((current) => ({ ...current, cliente: value }))}
              placeholder="Cliente ou proposta"
            />
          </ListFilterField>

          <ListFilterField label="Fila">
            <Select value={filters.etapa} onValueChange={(value) => setFilters((current) => ({ ...current, etapa: value }))}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="aguardando_financeiro">Aguardando financeiro</SelectItem>
                <SelectItem value="documentos">Documentos prontos</SelectItem>
              </SelectContent>
            </Select>
          </ListFilterField>
        </ListFilterGrid>
      </ListFilterPanel>

      <SectionCard
        title="Aprovacoes financeiras"
        description={`${comprasAguardandoAprovacao.length} pedido(s) aguardando sua liberacao`}
      >
        <FinanceTable
          compras={comprasAguardandoAprovacao}
          filters={filters}
          setFilters={setFilters}
          sort={sort}
          onSort={toggleSort}
          canViewCompras={canViewCompras}
          processingId={processingId}
          emptyMessage="Nenhum pedido aguardando aprovacao financeira no momento."
          renderActions={(compra) => (
            <RowActionsMenu label={`Acoes financeiras do pedido ${compra.id}`}>
              {canViewCompras ? (
                <DropdownMenuItem asChild>
                  <Link href={`/compras/${compra.id}`}>
                    <Eye className="h-4 w-4" />
                    Ver pedido
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() =>
                  runAction(
                    compra.id,
                    `/api/compras/${compra.id}/aprovacao-financeira`,
                    "Liberacao financeira registrada com sucesso.",
                  )
                }
                disabled={processingId === compra.id}
              >
                {processingId === compra.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeDollarSign className="h-4 w-4" />}
                {processingId === compra.id ? "Registrando..." : "Aprovar solicitacao"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const motivo = window.prompt("Informe o motivo da devolucao ao comprador (opcional).", "") ?? ""
                  runAction(
                    compra.id,
                    `/api/compras/${compra.id}/recusa-financeira`,
                    "Pedido devolvido ao comprador.",
                    { motivo },
                  )
                }}
                disabled={processingId === compra.id}
              >
                {processingId === compra.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {processingId === compra.id ? "Devolvendo..." : "Recusar e devolver"}
              </DropdownMenuItem>
            </RowActionsMenu>
          )}
        />
      </SectionCard>

      <SectionCard
        title="Notas e boletos para registrar"
        description={`${comprasAguardandoDocumentos.length} pedido(s) com nota fiscal e boleto prontos para baixa no financeiro`}
      >
        <FinanceTable
          compras={comprasAguardandoDocumentos}
          filters={filters}
          setFilters={setFilters}
          sort={sort}
          onSort={toggleSort}
          canViewCompras={canViewCompras}
          processingId={processingId}
          emptyMessage="Nenhum pedido com nota fiscal e boleto aguardando baixa no financeiro."
          renderActions={(compra) => (
            <RowActionsMenu label={`Baixa financeira do pedido ${compra.id}`}>
              {canViewCompras ? (
                <DropdownMenuItem asChild>
                  <Link href={`/compras/${compra.id}`}>
                    <Eye className="h-4 w-4" />
                    Ver pedido
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() =>
                  runAction(
                    compra.id,
                    `/api/compras/${compra.id}/confirmacao-documentos-financeiro`,
                    "Baixa financeira concluida com sucesso.",
                  )
                }
                disabled={processingId === compra.id}
              >
                {processingId === compra.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {processingId === compra.id ? "Concluindo..." : "Dar OK e concluir"}
              </DropdownMenuItem>
            </RowActionsMenu>
          )}
        />
      </SectionCard>
    </div>
  )
}

function FinanceTable({
  compras,
  filters,
  setFilters,
  sort,
  onSort,
  processingId,
  emptyMessage,
  renderActions,
}: {
  compras: Compra[]
  filters: {
    pedido: string
    cliente: string
    etapa: string
    updatedFrom: string
    updatedTo: string
  }
  setFilters: React.Dispatch<
    React.SetStateAction<{
      pedido: string
      cliente: string
      etapa: string
      updatedFrom: string
      updatedTo: string
    }>
  >
  sort: { column: SortColumn; direction: SortDirection }
  onSort: (column: SortColumn) => void
  canViewCompras: boolean
  processingId: number | null
  emptyMessage: string
  renderActions: (compra: Compra) => React.ReactNode
}) {
  if (compras.length === 0) {
    return <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">{emptyMessage}</div>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableTableHead
                label="Pedido"
                isActive={sort.column === "pedido"}
                direction={sort.direction}
                onClick={() => onSort("pedido")}
              />
            </TableHead>
            <TableHead>
              <SortableTableHead
                label="Cliente"
                isActive={sort.column === "cliente"}
                direction={sort.direction}
                onClick={() => onSort("cliente")}
              />
            </TableHead>
            <TableHead>
              <SortableTableHead
                label="Valor"
                isActive={sort.column === "valor"}
                direction={sort.direction}
                onClick={() => onSort("valor")}
              />
            </TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>
              <SortableTableHead
                label="Atualizado"
                isActive={sort.column === "atualizado"}
                direction={sort.direction}
                onClick={() => onSort("atualizado")}
              />
            </TableHead>
            <TableHead className="text-right">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {compras.map((compra) => (
            <TableRow key={compra.id}>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-mono text-sm font-medium">#{compra.id}</div>
                  <div className="text-xs text-muted-foreground">{compra.numero_pedido || "Numero pendente"}</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium">{compra.cliente_nome}</div>
                  <div className="text-xs text-muted-foreground">{compra.proposta_nome}</div>
                </div>
              </TableCell>
              <TableCell>{formatCurrency(compra.valor_total ?? 0)}</TableCell>
              <TableCell>
                <div className="space-y-2">
                  <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>
                    {ETAPA_FLUXO_LABELS[compra.etapa_fluxo]}
                  </Badge>
                  {compra.status !== compra.etapa_fluxo ? (
                    <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
              <TableCell className="text-right">{renderActions(compra)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
    case "valor":
      return (Number(left.valor_total ?? 0) - Number(right.valor_total ?? 0)) * modifier
    case "atualizado":
    default:
      return (new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()) * modifier
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0))
}
