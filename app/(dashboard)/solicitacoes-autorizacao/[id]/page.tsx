"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Save, ShieldCheck } from "lucide-react"
import { useLiveRefresh } from "@/components/shared/use-live-refresh"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ETAPA_FLUXO_BADGE_CLASSES, ETAPA_FLUXO_LABELS, STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/domain"
import type { Compra } from "@/lib/types"

type CompraDetalhe = Compra & {
  historico: Array<{ id: number; evento: string; data: string }>
}

export default function SolicitacaoAutorizacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [compra, setCompra] = useState<CompraDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    numero_pedido: "",
    valor_total: "",
  })
  const [isDirty, setIsDirty] = useState(false)

  async function fetchCompra() {
    try {
      const response = await fetch(`/api/compras/${id}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Pedido nao encontrado.")
      }

      const payload = await response.json()
      setCompra(payload)
      setFormData({
        numero_pedido: payload.numero_pedido ?? "",
        valor_total: payload.valor_total?.toString() ?? "",
      })
      setIsDirty(false)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchCompra()
  }, [id])

  useLiveRefresh(fetchCompra, {
    enabled: !saving && !rejecting && !isDirty,
    intervalMs: 10000,
  })

  function validate() {
    const nextErrors: Record<string, string> = {}

    if (!formData.numero_pedido.trim()) {
      nextErrors.numero_pedido = "Informe o numero do pedido."
    }

    if (!formData.valor_total || Number(formData.valor_total) <= 0) {
      nextErrors.valor_total = "Informe o valor autorizado."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSave() {
    if (!validate()) {
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/compras/${id}/aprovacao-autorizacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_pedido: formData.numero_pedido.trim(),
          valor_total: Number(formData.valor_total),
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao aprovar solicitacao.")
      }

      setIsDirty(false)
      router.push("/solicitacoes-autorizacao")
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao aprovar solicitacao.")
    } finally {
      setSaving(false)
    }
  }

  async function handleReject() {
    const motivo = window.prompt("Informe o motivo da recusa (opcional).", "") ?? ""

    setRejecting(true)

    try {
      const response = await fetch(`/api/compras/${id}/recusa-autorizacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao recusar solicitacao.")
      }

      router.push("/solicitacoes-autorizacao")
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao recusar solicitacao.")
    } finally {
      setRejecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (!compra) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Pedido nao encontrado</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Link href="/solicitacoes-autorizacao">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Aprovacao ADM do pedido #{compra.id}</h1>
            <Badge className={ETAPA_FLUXO_BADGE_CLASSES[compra.etapa_fluxo]}>{ETAPA_FLUXO_LABELS[compra.etapa_fluxo]}</Badge>
            <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
          </div>
          <p className="text-muted-foreground">
            {compra.cliente_nome} - {compra.proposta_nome}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Contexto do pedido</CardTitle>
            <CardDescription>O administrativo apenas aprova e registra numero do pedido e valor autorizado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Fornecedor">
              <InfoValue>{compra.fornecedor}</InfoValue>
            </Field>
            <Field label="Descricao">
              <div className="rounded-lg border bg-muted/15 p-4 text-sm leading-6 text-foreground">{compra.descricao}</div>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Solicitante">
                <InfoValue>{compra.solicitado_por || "Nao informado"}</InfoValue>
              </Field>
              <Field label="Cotacao enviada">
                <InfoValue>{compra.data_envio_fornecedor || "Sem data registrada"}</InfoValue>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Registro da aprovacao
            </CardTitle>
            <CardDescription>O administrativo registra a aprovacao, numero do pedido e valor. Depois disso, o comprador faz o envio ao financeiro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Numero do pedido *">
                <Input
                  value={formData.numero_pedido}
                  onChange={(event) => {
                    setIsDirty(true)
                    setFormData((current) => ({ ...current, numero_pedido: event.target.value }))
                    setErrors((current) => ({ ...current, numero_pedido: "" }))
                  }}
                placeholder="Ex: PED-2026-0184"
                className={errors.numero_pedido ? "border-destructive" : ""}
              />
              {errors.numero_pedido && <p className="text-sm text-destructive">{errors.numero_pedido}</p>}
            </Field>

            <Field label="Valor autorizado *">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_total}
                  onChange={(event) => {
                    setIsDirty(true)
                    setFormData((current) => ({ ...current, valor_total: event.target.value }))
                    setErrors((current) => ({ ...current, valor_total: "" }))
                  }}
                placeholder="0,00"
                className={errors.valor_total ? "border-destructive" : ""}
              />
              {errors.valor_total && <p className="text-sm text-destructive">{errors.valor_total}</p>}
            </Field>

            <div className="rounded-lg border bg-muted/15 p-4 text-sm text-muted-foreground">
              Depois desta aprovacao, o pedido volta para a fila do comprador. O proximo passo sera solicitar a ciencia financeira.
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <Link href="/solicitacoes-autorizacao">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
                <Button type="button" variant="outline" onClick={handleReject} disabled={saving || rejecting}>
                  {rejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {rejecting ? "Recusando..." : "Recusar e devolver"}
                </Button>
                <Button onClick={handleSave} disabled={saving || rejecting}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {saving ? "Salvando..." : "Aprovar pedido"}
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function InfoValue({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-muted/15 px-3 py-2 text-sm text-foreground">{children}</div>
}
