"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { AlertTriangle, CheckCircle2, Eye, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/domain"
import type { Cliente, Compra } from "@/lib/types"

export default function AutorizacoesPage() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("todos")
  const [clienteFilter, setClienteFilter] = useState<string>("todos")

  useEffect(() => {
    async function fetchData() {
      try {
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

    fetchData()
  }, [])

  const comprasPendentes = useMemo(() => compras.filter((compra) => compra.status !== "pedido_autorizado"), [compras])

  const filteredCompras = comprasPendentes.filter((compra) => {
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
  })

  const semDadosCompletos = comprasPendentes.filter(
    (compra) => !compra.numero_pedido || !compra.valor_total || !compra.previsao_entrega,
  ).length

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
          <h1 className="text-2xl font-bold text-foreground">Autorizacoes</h1>
          <p className="text-muted-foreground">
            Separe aqui a etapa de analise e autorizacao dos pedidos antes de enviar para entregas.
          </p>
        </div>
        <Link href="/compras">
          <Button variant="outline">Voltar para compras</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Pendentes" value={comprasPendentes.length} description="Pedidos ainda nao autorizados" />
        <SummaryCard
          title="Em analise"
          value={comprasPendentes.filter((compra) => compra.status === "em_analise").length}
          description="Pedidos em validacao"
        />
        <SummaryCard
          title="Dados faltando"
          value={semDadosCompletos}
          description="Sem numero, valor ou previsao para autorizar"
          tone="warning"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="cotacao">Cotacao</SelectItem>
                <SelectItem value="em_analise">Em analise</SelectItem>
                <SelectItem value="retificacao">Retificacao</SelectItem>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fila de autorizacao</CardTitle>
          <CardDescription>{filteredCompras.length} pedido(s) aguardando tratamento</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCompras.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              Nenhum pedido aguardando autorizacao.
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
                    <TableHead>Status</TableHead>
                    <TableHead>Numero</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Previsao</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompras.map((compra) => {
                    const faltandoDados = !compra.numero_pedido || !compra.valor_total || !compra.previsao_entrega

                    return (
                      <TableRow key={compra.id}>
                        <TableCell className="font-mono text-sm">#{compra.id}</TableCell>
                        <TableCell className="font-medium">{compra.cliente_nome}</TableCell>
                        <TableCell>{compra.proposta_nome}</TableCell>
                        <TableCell>{compra.fornecedor}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
                            {faltandoDados && (
                              <Badge className="bg-amber-100 text-amber-800">
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                Dados incompletos
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{compra.numero_pedido || "-"}</TableCell>
                        <TableCell>
                          {compra.valor_total
                            ? new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(Number(compra.valor_total))
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {compra.previsao_entrega
                            ? format(parseISO(compra.previsao_entrega), "dd/MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Link href={`/compras/${compra.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="mr-2 h-4 w-4" />
                                Ver pedido
                              </Button>
                            </Link>
                            <Link href={`/autorizacoes/${compra.id}`}>
                              <Button size="sm">
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Autorizar pedido
                              </Button>
                            </Link>
                          </div>
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

function SummaryCard({
  title,
  value,
  description,
  tone = "default",
}: {
  title: string
  value: number
  description: string
  tone?: "default" | "warning"
}) {
  return (
    <Card className={tone === "warning" ? "border-amber-200 bg-amber-50/60" : ""}>
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
