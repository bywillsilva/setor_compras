"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { BadgeDollarSign, CheckCircle2, Eye, Loader2, Search } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { RowActionsMenu } from "@/components/shared/row-actions-menu"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  valor_desc: "Maior valor",
  valor_asc: "Menor valor",
} as const

type SortOption = keyof typeof SORT_OPTIONS

export default function FinanceiroPage() {
  const session = useCurrentSession()
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("atualizacao_desc")
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
    fetchData()
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
    const term = search.trim().toLowerCase()

    return [...compras]
      .filter((compra) => {
        if (!matchesDateRange(compra.updated_at, dateFrom, dateTo)) {
          return false
        }

        if (!term) {
          return true
        }

        return (
          compra.cliente_nome?.toLowerCase().includes(term) ||
          compra.proposta_nome?.toLowerCase().includes(term) ||
          compra.fornecedor.toLowerCase().includes(term) ||
          compra.numero_pedido?.toLowerCase().includes(term)
        )
      })
      .sort((left, right) => sortCompras(left, right, sortBy))
  }, [compras, dateFrom, dateTo, search, sortBy])

  const comprasAguardandoAprovacao = filteredCompras.filter((compra) => compra.etapa_fluxo === "aguardando_financeiro")
  const comprasAguardandoDocumentos = filteredCompras.filter(
    (compra) =>
      compra.status === "pedido_autorizado" &&
      compra.possui_nf &&
      compra.possui_boleto &&
      !compra.documentos_financeiro_confirmados_em,
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground">
          Aprove a liberacao financeira e confirme depois o registro interno de nota fiscal e boleto.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, proposta, fornecedor ou numero do pedido..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-10"
                />
              </div>
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

      <FinanceQueueCard
        title="Aprovacoes financeiras"
        description={`${comprasAguardandoAprovacao.length} pedido(s) aguardando sua liberacao`}
        emptyMessage="Nenhum pedido aguardando aprovacao financeira no momento."
      >
        {comprasAguardandoAprovacao.map((compra) => (
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
                <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
              </div>
            </TableCell>
            <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
            <TableCell className="text-right">
              <RowActionsMenu label={`Acoes financeiras do pedido ${compra.id}`}>
                {canViewCompras && (
                  <DropdownMenuItem asChild>
                    <Link href={`/compras/${compra.id}`}>
                      <Eye className="h-4 w-4" />
                      Ver pedido
                    </Link>
                  </DropdownMenuItem>
                )}
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
            </TableCell>
          </TableRow>
        ))}
      </FinanceQueueCard>

      <FinanceQueueCard
        title="Notas e boletos para registrar"
        description={`${comprasAguardandoDocumentos.length} pedido(s) com nota fiscal e boleto prontos para baixa no financeiro`}
        emptyMessage="Nenhum pedido com nota fiscal e boleto aguardando baixa no financeiro."
      >
        {comprasAguardandoDocumentos.map((compra) => (
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
                <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
              </div>
            </TableCell>
            <TableCell>{format(new Date(compra.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
            <TableCell className="text-right">
              <RowActionsMenu label={`Baixa financeira do pedido ${compra.id}`}>
                {canViewCompras && (
                  <DropdownMenuItem asChild>
                    <Link href={`/compras/${compra.id}`}>
                      <Eye className="h-4 w-4" />
                      Ver pedido
                    </Link>
                  </DropdownMenuItem>
                )}
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
            </TableCell>
          </TableRow>
        ))}
      </FinanceQueueCard>
    </div>
  )
}

function FinanceQueueCard({
  title,
  description,
  emptyMessage,
  children,
}: {
  title: string
  description: string
  emptyMessage: string
  children: React.ReactNode
}) {
  const childCount = Array.isArray(children) ? children.length : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {childCount === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">{emptyMessage}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{children}</TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function sortCompras(left: Compra, right: Compra, sortBy: SortOption) {
  switch (sortBy) {
    case "atualizacao_asc":
      return new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()
    case "cliente_az":
      return (left.cliente_nome ?? "").localeCompare(right.cliente_nome ?? "", "pt-BR")
    case "valor_desc":
      return Number(right.valor_total ?? 0) - Number(left.valor_total ?? 0)
    case "valor_asc":
      return Number(left.valor_total ?? 0) - Number(right.valor_total ?? 0)
    case "atualizacao_desc":
    default:
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0))
}
