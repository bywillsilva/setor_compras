"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Eye, Search, Truck } from "lucide-react"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { DeliveryStatusBadge } from "@/components/compras/delivery-status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { matchesDateRange } from "@/lib/date-range"
import { getDeliverySituation } from "@/lib/domain"
import type { Cliente, Compra, SituacaoEntrega } from "@/lib/types"

const SORT_OPTIONS = {
  previsao_desc: "Previsao mais proxima",
  previsao_asc: "Previsao mais distante",
  cliente_az: "Cliente A-Z",
  fornecedor_az: "Fornecedor A-Z",
} as const

type SortOption = keyof typeof SORT_OPTIONS

export default function EntregasPage() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [situationFilter, setSituationFilter] = useState<string>("todos")
  const [clienteFilter, setClienteFilter] = useState<string>("todos")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("previsao_desc")

  useEffect(() => {
    async function fetchData() {
      try {
        const [comprasResponse, clientesResponse] = await Promise.all([
          fetch("/api/compras?status=pedido_autorizado"),
          fetch("/api/clientes"),
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

    fetchData()
  }, [])

  const metrics = useMemo(() => {
    return {
      total: compras.length,
      entregues: compras.filter((compra) => compra.status_entrega === "entregue").length,
      atrasados: compras.filter((compra) => getDeliverySituation(compra) === "atrasado").length,
      proximos: compras.filter((compra) => getDeliverySituation(compra) === "proximo").length,
    }
  }, [compras])

  const filteredCompras = useMemo(
    () =>
      [...compras]
        .filter((compra) => {
          const situacao = getDeliverySituation(compra)
          const term = search.toLowerCase()
          const matchSearch =
            compra.fornecedor.toLowerCase().includes(term) ||
            compra.descricao.toLowerCase().includes(term) ||
            compra.cliente_nome?.toLowerCase().includes(term) ||
            compra.proposta_nome?.toLowerCase().includes(term) ||
            compra.numero_pedido?.toLowerCase().includes(term)

          const matchSituation = situationFilter === "todos" || situacao === situationFilter
          const matchCliente = clienteFilter === "todos" || compra.cliente_id.toString() === clienteFilter

          return matchSearch && matchSituation && matchCliente
        })
        .filter((compra) => matchesDateRange(compra.previsao_entrega ?? compra.data_criacao, dateFrom, dateTo))
        .sort((left, right) => sortCompras(left, right, sortBy)),
    [clienteFilter, compras, dateFrom, dateTo, search, situationFilter, sortBy],
  )

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Entregas</h1>
          <p className="text-muted-foreground">
            Gerencie previsao, pendencias e confirmacao de entrega sem misturar com a fase de autorizacao.
          </p>
        </div>
        <Link href="/compras">
          <Button variant="outline">Voltar para compras</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Autorizados" value={metrics.total} description="Pedidos liberados para entrega" />
        <SummaryCard title="Entregues" value={metrics.entregues} description="Pedidos encerrados" />
        <SummaryCard title="Atrasados" value={metrics.atrasados} description="Entregas fora do prazo" tone="danger" />
        <SummaryCard title="Proximos" value={metrics.proximos} description="Entregas perto do vencimento" tone="warning" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por fornecedor, cliente, proposta ou pedido..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={situationFilter} onValueChange={setSituationFilter}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Situacao da entrega" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as situacoes</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="proximo">Proximo do vencimento</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="no_prazo">Dentro do prazo</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={clienteFilter} onValueChange={setClienteFilter}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os clientes</SelectItem>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id.toString()}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Ordenacao" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DateRangeFilter
              startDate={dateFrom}
              endDate={dateTo}
              onStartDateChange={setDateFrom}
              onEndDateChange={setDateTo}
              onClear={() => {
                setDateFrom("")
                setDateTo("")
              }}
              startLabel="Previsao de"
              endLabel="Previsao ate"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Controle de entregas</CardTitle>
          <CardDescription>{filteredCompras.length} pedido(s) em acompanhamento</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCompras.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              Nenhum pedido autorizado encontrado para acompanhamento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Proposta</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Situacao</TableHead>
                    <TableHead>Status entrega</TableHead>
                    <TableHead>Previsao</TableHead>
                    <TableHead>Data real</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompras.map((compra) => (
                    <TableRow key={compra.id}>
                      <TableCell className="font-mono text-sm">#{compra.id}</TableCell>
                      <TableCell className="font-medium">{compra.cliente_nome}</TableCell>
                      <TableCell>{compra.proposta_nome}</TableCell>
                      <TableCell>{compra.fornecedor}</TableCell>
                      <TableCell>
                        <DeliveryStatusBadge compra={compra} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{compra.status_entrega === "entregue" ? "Entregue" : "Pendente"}</Badge>
                      </TableCell>
                      <TableCell>
                        {compra.previsao_entrega
                          ? format(parseISO(compra.previsao_entrega), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {compra.data_entrega_real
                          ? format(parseISO(compra.data_entrega_real), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
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
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  description,
  tone = "default",
}: {
  title: string
  value: number
  description: string
  tone?: "default" | "warning" | "danger"
}) {
  const toneClass =
    tone === "warning" ? "border-amber-200 bg-amber-50/60" : tone === "danger" ? "border-red-200 bg-red-50/60" : ""

  return (
    <Card className={toneClass}>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function sortCompras(left: Compra, right: Compra, sortBy: SortOption) {
  switch (sortBy) {
    case "previsao_asc":
      return (right.previsao_entrega ?? "9999-12-31").localeCompare(left.previsao_entrega ?? "9999-12-31")
    case "cliente_az":
      return (left.cliente_nome ?? "").localeCompare(right.cliente_nome ?? "", "pt-BR")
    case "fornecedor_az":
      return left.fornecedor.localeCompare(right.fornecedor, "pt-BR")
    case "previsao_desc":
    default:
      return (left.previsao_entrega ?? "9999-12-31").localeCompare(right.previsao_entrega ?? "9999-12-31")
  }
}
