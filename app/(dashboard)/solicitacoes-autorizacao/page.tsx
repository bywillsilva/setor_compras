"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle2, Eye, Search } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
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
import { hasFeatureAccess } from "@/lib/auth/permissions"
import { matchesDateRange } from "@/lib/date-range"
import {
  CATEGORIA_LABELS,
  ETAPA_FLUXO_BADGE_CLASSES,
  ETAPA_FLUXO_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/domain"
import type { Cliente, Compra } from "@/lib/types"

const SORT_OPTIONS = {
  atualizacao_desc: "Atualizacao mais recente",
  atualizacao_asc: "Atualizacao mais antiga",
  cliente_az: "Cliente A-Z",
  fornecedor_az: "Fornecedor A-Z",
} as const

type SortOption = keyof typeof SORT_OPTIONS

export default function SolicitacoesAutorizacaoPage() {
  const session = useCurrentSession()
  const [compras, setCompras] = useState<Compra[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [clienteFilter, setClienteFilter] = useState("todos")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("atualizacao_desc")
  const canViewCompras = Boolean(session && hasFeatureAccess(session.perfil, "compras", session.features))

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
        .filter((compra) => compra.etapa_fluxo === "aguardando_admin")
        .sort((left, right) => sortCompras(left, right, sortBy)),
    [compras, sortBy],
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
      solicitadas: filteredCompras.length,
      comNumeroPendente: filteredCompras.filter((compra) => !compra.numero_pedido).length,
      comValorPendente: filteredCompras.filter((compra) => !compra.valor_total).length,
    }),
    [filteredCompras],
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
      <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground">Aprovacao ADM</h1>
        <p className="text-muted-foreground">Pedidos aprovados pelo solicitante e aguardando a liberacao do administrativo.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Na fila ADM" value={resumo.solicitadas} description="Aguardando numero e valor autorizado" />
        <SummaryCard title="Numero pendente" value={resumo.comNumeroPendente} description="Pedidos sem numero registrado" />
        <SummaryCard title="Valor pendente" value={resumo.comValorPendente} description="Pedidos sem valor autorizado" />
        <SummaryCard title="Clientes" value={resumo.clientesEnvolvidos} description="Clientes com pedidos na fila" />
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <SummaryCard
          title="Mais recente"
          value={filteredCompras[0] ? format(new Date(filteredCompras[0].updated_at), "dd/MM", { locale: ptBR }) : "--/--"}
          description="Ultima solicitacao aguardando o ADM"
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
              startLabel="Atualizado de"
              endLabel="Atualizado ate"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fila do administrador</CardTitle>
          <CardDescription>{filteredCompras.length} pedido(s) aguardando aprovacao administrativa</CardDescription>
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
                        <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>
                          {ETAPA_FLUXO_LABELS[compra.etapa_fluxo]}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu label={`Acoes da solicitacao ${compra.id}`}>
                          {canViewCompras && (
                            <>
                              <DropdownMenuItem asChild>
                                <Link href={`/compras/${compra.id}`}>
                                  <Eye className="h-4 w-4" />
                                  Ver pedido
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
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
        </CardContent>
      </Card>
    </div>
  )
}

function sortCompras(left: Compra, right: Compra, sortBy: SortOption) {
  switch (sortBy) {
    case "atualizacao_asc":
      return new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()
    case "cliente_az":
      return (left.cliente_nome ?? "").localeCompare(right.cliente_nome ?? "", "pt-BR")
    case "fornecedor_az":
      return left.fornecedor.localeCompare(right.fornecedor, "pt-BR")
    case "atualizacao_desc":
    default:
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  }
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
