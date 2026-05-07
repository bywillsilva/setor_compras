"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle2, Eye, Loader2, Search, Send } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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

export default function AutorizacoesPage() {
  const session = useCurrentSession()
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const canRequestApproval = Boolean(
    session && hasFeatureAccess(session.perfil, "solicitar_autorizacao", session.features),
  )
  const canViewCompras = Boolean(session && hasFeatureAccess(session.perfil, "compras", session.features))

  async function fetchData() {
    try {
      setLoading(true)
      const response = await fetch("/api/compras")
      if (!response.ok) {
        throw new Error("Erro ao carregar fila de autorizacoes.")
      }

      setCompras(await response.json())
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function handleRequestAuthorization(compraId: number) {
    setProcessingId(compraId)

    try {
      const response = await fetch(`/api/compras/${compraId}/solicitacao-autorizacao`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao solicitar autorizacao.")
      }

      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao solicitar autorizacao.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleRequestFinance(compraId: number) {
    setProcessingId(compraId)

    try {
      const response = await fetch(`/api/compras/${compraId}/solicitacao-financeira`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao solicitar aprovacao financeira.")
      }

      await fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao solicitar aprovacao financeira.")
    } finally {
      setProcessingId(null)
    }
  }

  const comprasPendentes = useMemo(
    () =>
      compras
        .filter((compra) => compra.status !== "pedido_autorizado")
        .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()),
    [compras],
  )

  const filteredCompras = useMemo(
    () =>
      comprasPendentes
        .filter((compra) => {
          const term = search.trim().toLowerCase()
          if (!term) {
            return true
          }

          return (
            compra.fornecedor.toLowerCase().includes(term) ||
            compra.descricao.toLowerCase().includes(term) ||
            compra.cliente_nome?.toLowerCase().includes(term) ||
            compra.proposta_nome?.toLowerCase().includes(term)
          )
        })
        .filter((compra) => matchesDateRange(compra.updated_at, dateFrom, dateTo)),
    [comprasPendentes, dateFrom, dateTo, search],
  )

  const resumo = useMemo(
    () => ({
      aguardandoSolicitante: filteredCompras.filter((compra) => compra.etapa_fluxo === "analise_solicitante").length,
      prontasParaSolicitarAdm: filteredCompras.filter((compra) => compra.etapa_fluxo === "aprovada_solicitante").length,
      aguardandoAdm: filteredCompras.filter((compra) => compra.etapa_fluxo === "aguardando_admin").length,
      prontasParaSolicitarFinanceiro: filteredCompras.filter((compra) => compra.etapa_fluxo === "aprovada_admin").length,
      aguardandoFinanceiro: filteredCompras.filter((compra) => compra.etapa_fluxo === "aguardando_financeiro").length,
      prontasParaFechar: filteredCompras.filter((compra) => compra.etapa_fluxo === "liberada_para_fornecedor").length,
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
        <h1 className="text-2xl font-bold text-foreground">Autorizacoes</h1>
        <p className="text-muted-foreground">
          Acompanhe toda a fila ligada a autorizacao: desde pedidos em cotacao ate os liberados para fechamento com o fornecedor.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard title="Em analise" value={resumo.aguardandoSolicitante} description="Esperando assinatura do solicitante" />
        <SummaryCard title="Para ADM" value={resumo.prontasParaSolicitarAdm} description="Prontos para enviar ao ADM" />
        <SummaryCard title="Aguardando ADM" value={resumo.aguardandoAdm} description="Pendentes de aprovacao administrativa" />
        <SummaryCard title="Para financeiro" value={resumo.prontasParaSolicitarFinanceiro} description="ADM aprovou, falta envio ao financeiro" />
        <SummaryCard title="Aguardando financeiro" value={resumo.aguardandoFinanceiro} description="Pendentes de ciencia financeira" />
        <SummaryCard title="Liberados" value={resumo.prontasParaFechar} description="Prontos para fechar com o fornecedor" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por fornecedor, cliente, proposta ou descricao..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-10"
              />
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
          <CardTitle>Fila do comprador</CardTitle>
          <CardDescription>{filteredCompras.length} pedido(s) nesta fila operacional</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCompras.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              Nenhum pedido pendente de autorizacao neste momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Atualizado</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompras.map((compra) => {
                    const isProcessing = processingId === compra.id
                    const canRequestAuthorization = compra.etapa_fluxo === "aprovada_solicitante"
                    const canRequestFinance = compra.etapa_fluxo === "aprovada_admin"
                    const canFinalize = compra.etapa_fluxo === "liberada_para_fornecedor"

                    return (
                      <TableRow key={compra.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-mono text-sm font-medium">#{compra.id}</div>
                            <div className="text-xs text-muted-foreground">{compra.proposta_nome}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{compra.cliente_nome}</TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>
                              {ETAPA_FLUXO_LABELS[compra.etapa_fluxo]}
                            </Badge>
                            <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>{compra.fornecedor}</TableCell>
                        <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell className="text-right">
                          <RowActionsMenu label={`Acoes do pedido ${compra.id}`}>
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

                            {canFinalize ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/autorizacoes/${compra.id}`}>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Confirmar com fornecedor
                                </Link>
                              </DropdownMenuItem>
                            ) : canRequestFinance && canRequestApproval ? (
                              <DropdownMenuItem onClick={() => handleRequestFinance(compra.id)} disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {isProcessing ? "Solicitando..." : "Solicitar assinatura do financeiro"}
                              </DropdownMenuItem>
                            ) : canRequestAuthorization && canRequestApproval ? (
                              <DropdownMenuItem onClick={() => handleRequestAuthorization(compra.id)} disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {isProcessing ? "Solicitando..." : "Solicitar assinatura do ADM"}
                              </DropdownMenuItem>
                            ) : compra.etapa_fluxo === "aguardando_admin" && canRequestApproval ? (
                              <DropdownMenuItem disabled>
                                <Loader2 className="h-4 w-4" />
                                Aguardando ADM
                              </DropdownMenuItem>
                            ) : compra.etapa_fluxo === "aguardando_financeiro" && canRequestApproval ? (
                              <DropdownMenuItem disabled>
                                <Loader2 className="h-4 w-4" />
                                Aguardando financeiro
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem asChild>
                                <Link href={`/solicitacoes/${compra.id}`}>
                                  <Eye className="h-4 w-4" />
                                  Acompanhar solicitacao
                                </Link>
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
