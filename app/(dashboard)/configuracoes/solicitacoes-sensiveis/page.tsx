"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { useLiveRefresh } from "@/components/shared/use-live-refresh"
import { PERFIL_LABELS } from "@/lib/auth/permissions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import type { SolicitacaoSensivel, SolicitacaoSensivelStatus } from "@/lib/types"

const STATUS_LABELS: Record<SolicitacaoSensivelStatus, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  recusada: "Recusada",
}

const STATUS_CLASSES: Record<SolicitacaoSensivelStatus, string> = {
  pendente: "bg-amber-100 text-amber-800 border-amber-200",
  aprovada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  recusada: "bg-red-100 text-red-800 border-red-200",
}

const ENTITY_LABELS = {
  cliente: "Cliente",
  proposta: "Proposta",
  compra: "Compra",
} as const

const ACTION_LABELS = {
  editar: "Alteracao",
  excluir: "Exclusao",
} as const

export default function SolicitacoesSensiveisPage() {
  const session = useCurrentSession()
  const [status, setStatus] = useState<"todos" | SolicitacaoSensivelStatus>("pendente")
  const [requests, setRequests] = useState<SolicitacaoSensivel[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.perfil === "admin") {
      void fetchRequests(status)
    }
  }, [session?.perfil, status])

  useLiveRefresh(() => fetchRequests(status, { silent: true }), {
    enabled: session?.perfil === "admin" && processingId === null,
    intervalMs: 12000,
  })

  async function fetchRequests(
    currentStatus: "todos" | SolicitacaoSensivelStatus,
    options: { silent?: boolean } = {},
  ) {
    const { silent = false } = options

    if (!silent) {
      setLoading(true)
    }
    setLoadError(null)

    try {
      const query = currentStatus === "todos" ? "" : `?status=${currentStatus}`
      const response = await fetch(`/api/solicitacoes-sensiveis${query}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao carregar solicitacoes administrativas.")
      }

      setRequests(Array.isArray(payload) ? payload : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar solicitacoes administrativas."
      setLoadError(message)
      setRequests([])
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  async function handleApprove(request: SolicitacaoSensivel) {
    const observacao = window.prompt("Observacao do administrador (opcional).")
    if (observacao === null) {
      return
    }

    setProcessingId(request.id)

    try {
      const response = await fetch(`/api/solicitacoes-sensiveis/${request.id}/aprovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacao_admin: observacao.trim() || null }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao aprovar solicitacao.")
      }

      await fetchRequests(status)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao aprovar solicitacao.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(request: SolicitacaoSensivel) {
    const observacao = window.prompt("Informe o motivo da recusa para registrar no historico.")
    if (observacao === null) {
      return
    }

    setProcessingId(request.id)

    try {
      const response = await fetch(`/api/solicitacoes-sensiveis/${request.id}/recusar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacao_admin: observacao.trim() || null }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao recusar solicitacao.")
      }

      await fetchRequests(status)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao recusar solicitacao.")
    } finally {
      setProcessingId(null)
    }
  }

  const resumo = useMemo(
    () => ({
      pendentes: requests.filter((request) => request.status === "pendente").length,
      aprovadas: requests.filter((request) => request.status === "aprovada").length,
      recusadas: requests.filter((request) => request.status === "recusada").length,
    }),
    [requests],
  )

  if (session?.perfil !== "admin") {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Acesso restrito</CardTitle>
            <CardDescription>Somente administradores podem revisar solicitacoes sensiveis.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/configuracoes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Solicitacoes administrativas</h1>
            <p className="text-muted-foreground">
              Aprove ou recuse pedidos de alteracao e exclusao antes de aplicar mudancas sensiveis no sistema.
            </p>
          </div>
        </div>

        <div className="w-full max-w-[220px]">
          <Select value={status} onValueChange={(value) => setStatus(value as "todos" | SolicitacaoSensivelStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="aprovada">Aprovadas</SelectItem>
              <SelectItem value="recusada">Recusadas</SelectItem>
              <SelectItem value="todos">Todos os status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard title="Pendentes" value={resumo.pendentes} description="Aguardando decisao administrativa" />
        <StatusCard title="Aprovadas" value={resumo.aprovadas} description="Ja executadas no sistema" />
        <StatusCard title="Recusadas" value={resumo.recusadas} description="Devolvidas ao solicitante" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Fila de aprovacao
          </CardTitle>
          <CardDescription>
            Cada registro mostra quem pediu, qual entidade sera afetada, o motivo e o resumo da alteracao antes da aprovacao final.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {loadError}
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhuma solicitacao encontrada neste filtro.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Acao</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Resumo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registrado em</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{request.solicitante_nome}</div>
                        <div className="text-xs text-muted-foreground">{PERFIL_LABELS[request.solicitante_perfil]}</div>
                      </div>
                    </TableCell>
                    <TableCell>{ENTITY_LABELS[request.entidade]}</TableCell>
                    <TableCell>{ACTION_LABELS[request.acao]}</TableCell>
                    <TableCell className="max-w-[220px] whitespace-pre-wrap text-sm">{request.motivo || "Sem motivo informado"}</TableCell>
                    <TableCell className="max-w-[260px] whitespace-pre-wrap text-xs text-muted-foreground">
                      {formatPayloadSummary(request)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_CLASSES[request.status]}>
                        {STATUS_LABELS[request.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(request.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {request.status === "pendente" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(request)}
                            disabled={processingId === request.id}
                          >
                            {processingId === request.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processando...
                              </>
                            ) : (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Recusar
                              </>
                            )}
                          </Button>
                          <Button size="sm" onClick={() => handleApprove(request)} disabled={processingId === request.id}>
                            {processingId === request.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processando...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Aprovar
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {request.status === "aprovada"
                            ? `Aprovada por ${request.aprovado_por ?? "ADM"}`
                            : `Recusada por ${request.recusado_por ?? "ADM"}`}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatusCard({ title, value, description }: { title: string; value: number; description: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function formatPayloadSummary(request: SolicitacaoSensivel) {
  if (request.acao === "excluir") {
    return "Exclusao definitiva solicitada."
  }

  if (!request.payload) {
    return "Sem campos detalhados."
  }

  const entries = Object.entries(request.payload)
    .filter(([, value]) => value !== null && value !== "")
    .slice(0, 4)
    .map(([key, value]) => `${humanizeKey(key)}: ${String(value)}`)

  return entries.length > 0 ? entries.join("\n") : "Sem campos detalhados."
}

function humanizeKey(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value: string) {
  try {
    return format(parseISO(value), "dd/MM/yyyy HH:mm", { locale: ptBR })
  } catch {
    return value
  }
}
