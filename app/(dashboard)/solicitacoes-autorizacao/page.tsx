"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle2, Eye, Loader2, Search } from "lucide-react"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { Badge } from "@/components/ui/badge"
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
import {
  CATEGORIA_LABELS,
  ETAPA_AUTORIZACAO_BADGE_CLASSES,
  ETAPA_AUTORIZACAO_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/domain"
import type { Cliente, Compra } from "@/lib/types"

export default function SolicitacoesAutorizacaoPage() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [clienteFilter, setClienteFilter] = useState("todos")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  async function fetchData() {
    try {
      setLoading(true)
      const [comprasResponse, clientesResponse] = await Promise.all([
        fetch("/api/compras"),
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

  useEffect(() => {
    fetchData()
  }, [])

  const comprasPendentes = useMemo(
    () =>
      compras
        .filter((compra) => compra.status !== "pedido_autorizado")
        .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()),
    [compras],
  )

  const filteredCompras = comprasPendentes
    .filter((compra) => {
      const term = search.toLowerCase()
      const matchSearch =
        compra.fornecedor.toLowerCase().includes(term) ||
        compra.descricao.toLowerCase().includes(term) ||
        compra.cliente_nome?.toLowerCase().includes(term) ||
        compra.proposta_nome?.toLowerCase().includes(term)

      const matchCliente = clienteFilter === "todos" || compra.cliente_id.toString() === clienteFilter
      return matchSearch && matchCliente
    })
    .filter((compra) => matchesDateRange(compra.updated_at, dateFrom, dateTo))

  const resumo = useMemo(
    () => ({
      clientesEnvolvidos: new Set(filteredCompras.map((compra) => compra.cliente_id)).size,
      semSolicitacao: filteredCompras.filter((compra) => compra.etapa_autorizacao === "nenhuma").length,
      solicitadas: filteredCompras.filter((compra) => compra.etapa_autorizacao === "solicitada").length,
      liberadas: filteredCompras.filter((compra) => compra.etapa_autorizacao === "liberada").length,
    }),
    [filteredCompras],
  )

  async function handleApprove(compraId: number) {
    setProcessingId(compraId)

    try {
      const response = await fetch(`/api/compras/${compraId}/aprovacao-autorizacao`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao aprovar solicitacao.")
      }

      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao aprovar solicitacao.")
    } finally {
      setProcessingId(null)
    }
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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">Solicitacoes de autorizacao</h1>
        <p className="text-muted-foreground">Visao administrativa de todos os pedidos ainda nao autorizados, inclusive os que continuam em cotacao.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Sem solicitacao" value={resumo.semSolicitacao} description="Pedidos ainda na fila do comprador" />
        <SummaryCard title="Para aprovar" value={resumo.solicitadas} description="Solicitacoes aguardando aprovacao" />
        <SummaryCard title="Liberados" value={resumo.liberadas} description="Ja aprovados pelo administrativo" />
        <SummaryCard title="Clientes" value={resumo.clientesEnvolvidos} description="Clientes com pedidos na fila" />
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <SummaryCard
          title="Mais recente"
          value={filteredCompras[0] ? format(new Date(filteredCompras[0].updated_at), "dd/MM", { locale: ptBR }) : "--/--"}
          description="Ultima solicitacao registrada"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por fornecedor, cliente ou proposta..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={clienteFilter} onValueChange={setClienteFilter}>
                <SelectTrigger className="w-full md:w-[240px]">
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
              startLabel="Atualizado de"
              endLabel="Atualizado ate"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fila do administrador</CardTitle>
          <CardDescription>{filteredCompras.length} pedido(s) em cotacao ou aguardando autorizacao</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCompras.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              Nenhum pedido pendente de autorizacao no momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Atualizado em</TableHead>
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
                        <Badge className={ETAPA_AUTORIZACAO_BADGE_CLASSES[compra.etapa_autorizacao]}>
                          {ETAPA_AUTORIZACAO_LABELS[compra.etapa_autorizacao]}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu label={`Acoes da solicitacao ${compra.id}`}>
                          <DropdownMenuItem asChild>
                            <Link href={`/compras/${compra.id}`}>
                              <Eye className="h-4 w-4" />
                              Ver pedido
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {compra.etapa_autorizacao === "solicitada" ? (
                            <DropdownMenuItem onClick={() => handleApprove(compra.id)} disabled={processingId === compra.id}>
                              {processingId === compra.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              {processingId === compra.id ? "Aprovando..." : "Aprovar solicitacao"}
                            </DropdownMenuItem>
                          ) : compra.etapa_autorizacao === "liberada" ? (
                            <DropdownMenuItem disabled>
                              <CheckCircle2 className="h-4 w-4" />
                              Ja liberado ao comprador
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled>
                              <Loader2 className="h-4 w-4" />
                              Aguardando solicitacao do comprador
                            </DropdownMenuItem>
                          )}
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
}: {
  title: string
  value: number | string
  description: string
}) {
  return (
    <Card>
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
