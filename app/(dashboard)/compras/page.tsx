"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { AlertTriangle, CheckCircle2, Download, Eye, Loader2, Plus, Search, Send, Truck } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { DeliveryStatusBadge } from "@/components/compras/delivery-status-badge"
import { hasFeatureAccess } from "@/lib/auth/permissions"
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
  ETAPA_FLUXO_BADGE_CLASSES,
  ETAPA_FLUXO_LABELS,
  STATUS_LABELS,
} from "@/lib/domain"
import type { Cliente, Compra } from "@/lib/types"

const ARCHIVE_FILTER_LABELS = {
  ativos: "Ativos",
  arquivados: "Arquivados",
  todos: "Todos",
} as const

const SORT_OPTIONS = {
  movimentacao_desc: "Movimentacao mais recente",
  movimentacao_asc: "Movimentacao mais antiga",
  cliente_az: "Cliente A-Z",
  proposta_az: "Proposta A-Z",
  fornecedor_az: "Fornecedor A-Z",
  pedido_az: "Pedido A-Z",
  valor_desc: "Maior valor",
  valor_asc: "Menor valor",
} as const

type SortOption = keyof typeof SORT_OPTIONS

export default function ComprasPage() {
  const session = useCurrentSession()
  const [compras, setCompras] = useState<Compra[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("todos")
  const [clienteFilter, setClienteFilter] = useState<string>("todos")
  const [archiveFilter, setArchiveFilter] = useState<keyof typeof ARCHIVE_FILTER_LABELS>("ativos")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("movimentacao_desc")
  const canRequestApproval = Boolean(
    session && hasFeatureAccess(session.perfil, "solicitar_autorizacao", session.features),
  )
  const canFinalizeFornecedor = Boolean(
    session && hasFeatureAccess(session.perfil, "autorizacoes", session.features),
  )

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

  async function runWorkflowAction(compraId: number, path: string, successMessage: string) {
    setProcessingId(compraId)

    try {
      const response = await fetch(path, { method: "POST" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao atualizar fluxo da compra.")
      }

      alert(successMessage)
      await fetchCompras()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar fluxo da compra.")
    } finally {
      setProcessingId(null)
    }
  }

  const filteredCompras = useMemo(() => {
    const term = search.trim().toLowerCase()

    return [...compras]
      .filter((compra) => {
        const matchSearch =
          !term ||
          compra.fornecedor.toLowerCase().includes(term) ||
          compra.descricao.toLowerCase().includes(term) ||
          compra.cliente_nome?.toLowerCase().includes(term) ||
          compra.proposta_nome?.toLowerCase().includes(term) ||
          compra.numero_pedido?.toLowerCase().includes(term)

        const matchStatus = statusFilter === "todos" || compra.status === statusFilter
        const matchCliente = clienteFilter === "todos" || compra.cliente_id.toString() === clienteFilter
        const matchDate = matchesDateRange(compra.updated_at, dateFrom, dateTo)

        return matchSearch && matchStatus && matchCliente && matchDate
      })
      .sort((left, right) => sortCompras(left, right, sortBy))
  }, [clienteFilter, compras, dateFrom, dateTo, search, sortBy, statusFilter])

  const reportHref = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("search", search.trim())
    if (statusFilter !== "todos") params.set("status", statusFilter)
    if (clienteFilter !== "todos") params.set("clienteId", clienteFilter)
    if (archiveFilter !== "ativos") params.set("arquivados", archiveFilter)
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    params.set("sortBy", sortBy)
    return `/api/compras/relatorio?${params.toString()}`
  }, [archiveFilter, clienteFilter, dateFrom, dateTo, search, sortBy, statusFilter])

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
          <p className="text-muted-foreground">
            Fila operacional do comprador, desde a solicitacao inicial ate a entrega do material.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={reportHref}>
              <Download className="mr-2 h-4 w-4" />
              Baixar relatorio
            </a>
          </Button>
          <Link href="/compras/novo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova compra
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por fornecedor, descricao, cliente, proposta ou pedido..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-4 xl:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full xl:w-[190px]">
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
                  <SelectTrigger className="w-full xl:w-[220px]">
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
                  <SelectTrigger className="w-full xl:w-[150px]">
                    <SelectValue placeholder="Arquivamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativos">Ativos</SelectItem>
                    <SelectItem value="arquivados">Arquivados</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                  <SelectTrigger className="w-full xl:w-[220px]">
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
          <CardTitle>Pedidos de compra</CardTitle>
          <CardDescription>
            {filteredCompras.length} pedido(s) encontrado(s) mostrando {ARCHIVE_FILTER_LABELS[archiveFilter].toLowerCase()}
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
                    <TableHead>Cliente e proposta</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Fluxo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Movimentacao</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompras.map((compra) => {
                    const isProcessing = processingId === compra.id
                    const documentosPendentes = [
                      !compra.possui_nf ? "NF" : null,
                      !compra.possui_boleto ? "boleto" : null,
                    ].filter(Boolean)
                    const aguardandoRegistroFinanceiro =
                      compra.status === "pedido_autorizado" &&
                      compra.possui_nf &&
                      compra.possui_boleto &&
                      !compra.documentos_financeiro_confirmados_em

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
                          <div className="min-w-[190px] space-y-1">
                            <div className="font-medium">{compra.cliente_nome}</div>
                            <div className="text-xs text-muted-foreground">{compra.proposta_nome}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[180px] space-y-1">
                            <div className="font-medium text-foreground">{compra.fornecedor}</div>
                            <Badge variant="outline">{CATEGORIA_LABELS[compra.categoria]}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[280px] space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>
                                {ETAPA_FLUXO_LABELS[compra.etapa_fluxo]}
                              </Badge>
                              {compra.status === "pedido_autorizado" ? <DeliveryStatusBadge compra={compra} /> : null}
                            </div>
                            <p className="text-xs leading-5 text-muted-foreground">{getCompraFlowNote(compra)}</p>
                            {compra.status === "pedido_autorizado" && documentosPendentes.length > 0 && (
                              <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {`Pendencias: ${documentosPendentes.join(" e ")}`}
                              </div>
                            )}
                            {aguardandoRegistroFinanceiro && (
                              <div className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-800">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Financeiro ainda precisa registrar NF e boleto
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">
                              {compra.valor_total
                                ? new Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  }).format(Number(compra.valor_total))
                                : "-"}
                            </div>
                            <div className="text-xs text-muted-foreground">{STATUS_LABELS[compra.status]}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div>{format(parseISO(compra.updated_at), "dd/MM/yyyy", { locale: ptBR })}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(parseISO(compra.updated_at), "HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                        </TableCell>
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
                                {compra.etapa_fluxo === "solicitacao_registrada" || compra.etapa_fluxo === "retificacao" ? (
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    onClick={() =>
                                      runWorkflowAction(
                                        compra.id,
                                        `/api/compras/${compra.id}/envio-cotacao`,
                                        "Solicitacao enviada para cotacao.",
                                      )
                                    }
                                  >
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    {isProcessing ? "Enviando..." : "Enviar para cotacao"}
                                  </DropdownMenuItem>
                                ) : compra.etapa_fluxo === "cotacao_em_andamento" ? (
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    onClick={() =>
                                      runWorkflowAction(
                                        compra.id,
                                        `/api/compras/${compra.id}/recebimento-cotacao`,
                                        "Cotacao enviada para aprovacao do solicitante.",
                                      )
                                    }
                                  >
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    {isProcessing ? "Solicitando..." : "Solicitar aprovacao do solicitante"}
                                  </DropdownMenuItem>
                                ) : compra.etapa_fluxo === "analise_solicitante" ? (
                                  <DropdownMenuItem disabled>
                                    <Loader2 className="h-4 w-4" />
                                    Aguardando solicitante
                                  </DropdownMenuItem>
                                ) : canRequestApproval && compra.etapa_fluxo === "aprovada_solicitante" ? (
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    onClick={() =>
                                      runWorkflowAction(
                                        compra.id,
                                        `/api/compras/${compra.id}/solicitacao-autorizacao`,
                                        "Solicitacao enviada ao administrador.",
                                      )
                                    }
                                  >
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                    {isProcessing ? "Solicitando..." : "Solicitar aprovacao do ADM"}
                                  </DropdownMenuItem>
                                ) : compra.etapa_fluxo === "aguardando_admin" ? (
                                  <DropdownMenuItem disabled>
                                    <Loader2 className="h-4 w-4" />
                                    Aguardando ADM
                                  </DropdownMenuItem>
                                ) : canRequestApproval && compra.etapa_fluxo === "aprovada_admin" ? (
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    onClick={() =>
                                      runWorkflowAction(
                                        compra.id,
                                        `/api/compras/${compra.id}/solicitacao-financeira`,
                                        "Solicitacao enviada ao financeiro.",
                                      )
                                    }
                                  >
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                    {isProcessing ? "Solicitando..." : "Solicitar aprovacao do financeiro"}
                                  </DropdownMenuItem>
                                ) : compra.etapa_fluxo === "aguardando_financeiro" ? (
                                  <DropdownMenuItem disabled>
                                    <Loader2 className="h-4 w-4" />
                                    Aguardando financeiro
                                  </DropdownMenuItem>
                                ) : canFinalizeFornecedor && compra.etapa_fluxo === "liberada_para_fornecedor" ? (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/autorizacoes/${compra.id}`}>
                                      <CheckCircle2 className="h-4 w-4" />
                                      Fechar com fornecedor
                                    </Link>
                                  </DropdownMenuItem>
                                ) : compra.status === "pedido_autorizado" ? (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/entregas/${compra.id}`}>
                                      <Truck className="h-4 w-4" />
                                      {compra.status_entrega === "entregue" ? "Revisar entrega" : "Informar entrega"}
                                    </Link>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem disabled>
                                    <AlertTriangle className="h-4 w-4" />
                                    Sem acao imediata
                                  </DropdownMenuItem>
                                )}
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

function sortCompras(left: Compra, right: Compra, sortBy: SortOption) {
  switch (sortBy) {
    case "movimentacao_asc":
      return new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()
    case "cliente_az":
      return (left.cliente_nome ?? "").localeCompare(right.cliente_nome ?? "", "pt-BR")
    case "proposta_az":
      return (left.proposta_nome ?? "").localeCompare(right.proposta_nome ?? "", "pt-BR")
    case "fornecedor_az":
      return left.fornecedor.localeCompare(right.fornecedor, "pt-BR")
    case "pedido_az":
      return (left.numero_pedido ?? `#${left.id}`).localeCompare(right.numero_pedido ?? `#${right.id}`, "pt-BR")
    case "valor_desc":
      return Number(right.valor_total ?? 0) - Number(left.valor_total ?? 0)
    case "valor_asc":
      return Number(left.valor_total ?? 0) - Number(right.valor_total ?? 0)
    case "movimentacao_desc":
    default:
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  }
}

function getCompraFlowNote(compra: Compra) {
  switch (compra.etapa_fluxo) {
    case "solicitacao_registrada":
      return "Material solicitado pela producao e aguardando envio do comprador para cotacao."
    case "cotacao_em_andamento":
      return compra.data_envio_fornecedor
        ? `Cotacao enviada ao fornecedor em ${format(parseISO(compra.data_envio_fornecedor), "dd/MM/yyyy", { locale: ptBR })}.`
        : "Cotacao em andamento com o fornecedor."
    case "analise_solicitante":
      return "Comprador ja anexou a cotacao e aguarda a aprovacao do solicitante."
    case "retificacao":
      return "Solicitante pediu ajuste antes do envio para a aprovacao administrativa."
    case "aprovada_solicitante":
      return "Solicitante aprovou a cotacao; o proximo passo e enviar para o ADM."
    case "aguardando_admin":
      return "Aguardando a assinatura administrativa para seguir com a compra."
    case "aprovada_admin":
      return "ADM aprovou com numero e valor. Falta solicitar a assinatura do financeiro."
    case "aguardando_financeiro":
      return "Financeiro precisa aprovar antes do fechamento com o fornecedor."
    case "liberada_para_fornecedor":
      return "Todas as assinaturas foram registradas. Falta fechar com o fornecedor."
    case "pedido_autorizado":
      return compra.previsao_entrega
        ? `Pedido fechado com o fornecedor. Previsao de entrega em ${format(parseISO(compra.previsao_entrega), "dd/MM/yyyy", { locale: ptBR })}.`
        : "Pedido fechado com o fornecedor."
    default:
      return "Pedido em acompanhamento."
  }
}
