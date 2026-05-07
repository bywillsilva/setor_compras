"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle2, ClipboardList, Eye, Loader2, Plus, Search } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { hasFeatureAccess } from "@/lib/auth/permissions"
import { matchesDateRange } from "@/lib/date-range"
import {
  ETAPA_FLUXO_BADGE_CLASSES,
  ETAPA_FLUXO_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/domain"
import type { Compra } from "@/lib/types"

const SORT_OPTIONS = {
  atualizacao_desc: "Atualizacao mais recente",
  atualizacao_asc: "Atualizacao mais antiga",
  cliente_az: "Cliente A-Z",
  proposta_az: "Proposta A-Z",
} as const

type SortOption = keyof typeof SORT_OPTIONS

export default function SolicitacoesPage() {
  const session = useCurrentSession()
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("atualizacao_desc")

  const canCreateSolicitacao = Boolean(session && hasFeatureAccess(session.perfil, "solicitacoes", session.features))

  async function fetchSolicitacoes() {
    try {
      setLoading(true)
      const response = await fetch("/api/solicitacoes")
      if (!response.ok) {
        throw new Error("Erro ao carregar solicitacoes.")
      }

      setCompras(await response.json())
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSolicitacoes()
  }, [])

  async function handleApprove(compraId: number) {
    setProcessingId(compraId)

    try {
      const response = await fetch(`/api/solicitacoes/${compraId}/aprovar`, { method: "POST" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao aprovar solicitacao.")
      }

      await fetchSolicitacoes()
      alert("Solicitacao aprovada para seguir ao administrativo.")
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao aprovar solicitacao.")
    } finally {
      setProcessingId(null)
    }
  }

  const filteredCompras = useMemo(
    () =>
      compras
        .filter((compra) => {
          const term = search.trim().toLowerCase()
          if (!term) {
            return true
          }

          return (
            compra.descricao.toLowerCase().includes(term) ||
            compra.fornecedor.toLowerCase().includes(term) ||
            compra.cliente_nome?.toLowerCase().includes(term) ||
            compra.proposta_nome?.toLowerCase().includes(term)
          )
        })
        .filter((compra) => matchesDateRange(compra.updated_at, dateFrom, dateTo))
        .sort((left, right) => sortCompras(left, right, sortBy)),
    [compras, dateFrom, dateTo, search, sortBy],
  )

  const resumo = useMemo(
    () => ({
      total: filteredCompras.length,
      emCotacao: filteredCompras.filter((compra) =>
        ["solicitacao_registrada", "cotacao_em_andamento", "retificacao"].includes(compra.etapa_fluxo),
      ).length,
      emAnalise: filteredCompras.filter((compra) => compra.etapa_fluxo === "analise_solicitante").length,
      aprovadas: filteredCompras.filter((compra) =>
        ["aprovada_solicitante", "aguardando_admin", "aprovada_admin", "aguardando_financeiro", "liberada_para_fornecedor", "pedido_autorizado"].includes(
          compra.etapa_fluxo,
        ),
      ).length,
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitacoes</h1>
          <p className="text-muted-foreground">
            Registre a necessidade de material da obra e acompanhe a aprovacao da cotacao pelo seu setor.
          </p>
        </div>

        {canCreateSolicitacao && (
          <Link href="/solicitacoes/novo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova solicitacao
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Solicitacoes" value={resumo.total} description="Pedidos registrados por voce" />
        <SummaryCard title="Em cotacao" value={resumo.emCotacao} description="Aguardando retorno do comprador" />
        <SummaryCard title="Em analise" value={resumo.emAnalise} description="Aguardando sua aprovacao" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, proposta, fornecedor ou descricao..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-10"
                />
              </div>
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
          <CardTitle>Suas solicitacoes</CardTitle>
          <CardDescription>{filteredCompras.length} pedido(s) nesta visao</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCompras.length === 0 ? (
            <div className="space-y-4 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              <p>Nenhuma solicitacao encontrada para os filtros atuais.</p>
              {canCreateSolicitacao && (
                <div>
                  <Link href="/solicitacoes/novo">
                    <Button variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Registrar nova solicitacao
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Solicitacao</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Situacao</TableHead>
                    <TableHead>Atualizado</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompras.map((compra) => {
                    const isProcessing = processingId === compra.id
                    const canApprove = session?.userId === compra.solicitante_id && compra.etapa_fluxo === "analise_solicitante"

                    return (
                      <TableRow key={compra.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-mono text-sm font-medium">#{compra.id}</div>
                            <div className="text-xs text-muted-foreground">{compra.proposta_nome}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{compra.cliente_nome}</div>
                            {compra.solicitado_por && (
                              <div className="text-xs text-muted-foreground">Registrada por {compra.solicitado_por}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{compra.fornecedor}</TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>
                              {ETAPA_FLUXO_LABELS[compra.etapa_fluxo]}
                            </Badge>
                            <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell className="text-right">
                          <RowActionsMenu label={`Acoes da solicitacao ${compra.id}`}>
                            <DropdownMenuItem asChild>
                              <Link href={`/solicitacoes/${compra.id}`}>
                                <Eye className="h-4 w-4" />
                                Abrir solicitacao
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />

                            {canApprove ? (
                              <DropdownMenuItem onClick={() => handleApprove(compra.id)} disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                {isProcessing ? "Aprovando..." : "Aprovar solicitacao de compra"}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled>
                                <ClipboardList className="h-4 w-4" />
                                Sem acao imediata
                              </DropdownMenuItem>
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
    case "atualizacao_asc":
      return new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()
    case "cliente_az":
      return (left.cliente_nome ?? "").localeCompare(right.cliente_nome ?? "", "pt-BR")
    case "proposta_az":
      return (left.proposta_nome ?? "").localeCompare(right.proposta_nome ?? "", "pt-BR")
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
