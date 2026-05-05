"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle2, Eye, Plus, Search, Truck } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
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
import {
  CATEGORIA_LABELS,
  ETAPA_AUTORIZACAO_BADGE_CLASSES,
  ETAPA_AUTORIZACAO_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/domain"
import type { Cliente, Compra } from "@/lib/types"

const ARCHIVE_FILTER_LABELS = {
  ativos: "Ativos",
  arquivados: "Arquivados",
  todos: "Todos",
} as const

export default function ComprasPage() {
  const session = useCurrentSession()
  const [compras, setCompras] = useState<Compra[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [requestingId, setRequestingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("todos")
  const [clienteFilter, setClienteFilter] = useState<string>("todos")
  const [archiveFilter, setArchiveFilter] = useState<keyof typeof ARCHIVE_FILTER_LABELS>("ativos")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  async function fetchCompras(selectedArchiveFilter = archiveFilter) {
    try {
      setLoading(true)
      const query = selectedArchiveFilter === "ativos" ? "" : `?arquivados=${selectedArchiveFilter}`
      const comprasResponse = await fetch(`/api/compras${query}`)

      if (comprasResponse.ok) {
        setCompras(await comprasResponse.json())
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompras()
  }, [archiveFilter])

  useEffect(() => {
    async function fetchClientes() {
      const clientesResponse = await fetch("/api/clientes")

      if (clientesResponse.ok) {
        setClientes(await clientesResponse.json())
      }
    }

    fetchClientes()
  }, [])

  const filteredCompras = compras.filter((compra) => {
    const term = search.toLowerCase()
    const matchSearch =
      compra.fornecedor.toLowerCase().includes(term) ||
      compra.descricao.toLowerCase().includes(term) ||
      compra.cliente_nome?.toLowerCase().includes(term) ||
      compra.proposta_nome?.toLowerCase().includes(term) ||
      compra.numero_pedido?.toLowerCase().includes(term)

    const matchStatus = statusFilter === "todos" || compra.status === statusFilter
    const matchCliente = clienteFilter === "todos" || compra.cliente_id.toString() === clienteFilter

    return matchSearch && matchStatus && matchCliente
  }).filter((compra) => matchesDateRange(compra.data_criacao, dateFrom, dateTo))

  async function handleRequestAuthorization(compraId: number) {
    setRequestingId(compraId)

    try {
      const response = await fetch(`/api/compras/${compraId}/solicitacao-autorizacao`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao solicitar autorizacao.")
      }

      alert("Solicitacao enviada ao administrador.")
      await fetchCompras()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao solicitar autorizacao.")
    } finally {
      setRequestingId(null)
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compras</h1>
          <p className="text-muted-foreground">Visao geral dos pedidos de compra.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/compras/novo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Compra
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por fornecedor, descricao, cliente ou pedido..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="cotacao">Cotacao</SelectItem>
                  <SelectItem value="em_analise">Em analise</SelectItem>
                  <SelectItem value="retificacao">Retificacao</SelectItem>
                  <SelectItem value="pedido_autorizado">Pedido autorizado</SelectItem>
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
              <Select value={archiveFilter} onValueChange={(value) => setArchiveFilter(value as keyof typeof ARCHIVE_FILTER_LABELS)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Arquivamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="arquivados">Arquivados</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
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
              startLabel="Criado de"
              endLabel="Criado ate"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos de compra</CardTitle>
          <CardDescription>
            {filteredCompras.length} pedido(s) encontrado(s) • mostrando {ARCHIVE_FILTER_LABELS[archiveFilter].toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCompras.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>{archiveFilter === "arquivados" ? "Nenhuma compra arquivada encontrada." : "Nenhum pedido encontrado."}</p>
              {archiveFilter !== "arquivados" && (
                <Link href="/compras/novo" className="text-sm text-primary hover:underline">
                  Criar primeiro pedido
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Situacao</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Atualizacao</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                  {filteredCompras.map((compra) => {
                    const aguardandoAdministrador = compra.etapa_autorizacao === "solicitada"
                    const liberadaParaConclusao = compra.etapa_autorizacao === "liberada"

                    return (
                    <TableRow key={compra.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-sm font-medium">#{compra.id}</div>
                            {compra.arquivado && <Badge variant="outline">Arquivado</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {compra.numero_pedido ? `Pedido ${compra.numero_pedido}` : "Numero pendente"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{compra.cliente_nome}</div>
                          <div className="text-xs text-muted-foreground">{compra.proposta_nome}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{compra.fornecedor}</div>
                          <Badge variant="outline">{CATEGORIA_LABELS[compra.categoria]}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
                          {compra.etapa_autorizacao !== "nenhuma" && (
                            <Badge className={ETAPA_AUTORIZACAO_BADGE_CLASSES[compra.etapa_autorizacao]}>
                              {ETAPA_AUTORIZACAO_LABELS[compra.etapa_autorizacao]}
                            </Badge>
                          )}
                          <div className="text-xs text-muted-foreground">
                            <DeliveryStatusBadge compra={compra} />
                          </div>
                          {compra.previsao_entrega && (
                            <div className="text-xs text-muted-foreground">
                              Prev.: {format(parseISO(compra.previsao_entrega), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {compra.valor_total
                          ? new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(Number(compra.valor_total))
                          : "-"}
                      </TableCell>
                      <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu label={`Acoes do pedido ${compra.id}`}>
                          <DropdownMenuItem asChild>
                            <Link href={`/compras/${compra.id}`}>
                              <Eye className="h-4 w-4" />
                              Abrir pedido
                            </Link>
                          </DropdownMenuItem>

                          {!compra.arquivado && (
                            <>
                              <DropdownMenuSeparator />
                              {compra.status === "pedido_autorizado" ? (
                                <DropdownMenuItem asChild>
                                  <Link href={`/entregas/${compra.id}`}>
                                    <Truck className="h-4 w-4" />
                                    Informar entrega
                                  </Link>
                                </DropdownMenuItem>
                              ) : session?.perfil === "comprador" && liberadaParaConclusao ? (
                                <DropdownMenuItem asChild>
                                  <Link href={`/autorizacoes/${compra.id}`}>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Preencher autorizacao
                                  </Link>
                                </DropdownMenuItem>
                              ) : session?.perfil === "comprador" && aguardandoAdministrador ? (
                                <DropdownMenuItem disabled>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Aguardando administrador
                                </DropdownMenuItem>
                              ) : session?.perfil === "comprador" ? (
                                <DropdownMenuItem
                                  disabled={requestingId === compra.id}
                                  onClick={() => handleRequestAuthorization(compra.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  {requestingId === compra.id ? "Solicitando..." : "Solicitar autorizacao"}
                                </DropdownMenuItem>
                              ) : aguardandoAdministrador ? (
                                <DropdownMenuItem asChild>
                                  <Link href="/solicitacoes-autorizacao">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Ver solicitacoes
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              {session?.perfil === "admin" && liberadaParaConclusao ? (
                                <DropdownMenuItem disabled>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Liberado para comprador
                                </DropdownMenuItem>
                              ) : null}
                            </>
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
        </CardContent>
      </Card>
    </div>
  )
}
