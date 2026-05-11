"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2, Save } from "lucide-react"
import { useLiveRefresh } from "@/components/shared/use-live-refresh"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ETAPA_FLUXO_BADGE_CLASSES,
  ETAPA_FLUXO_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from "@/lib/domain"
import type { Compra } from "@/lib/types"

type CompraDetalhe = Compra & {
  historico: Array<{ id: number; evento: string; data: string }>
}

export default function AutorizacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [compra, setCompra] = useState<CompraDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [previsaoEntrega, setPrevisaoEntrega] = useState("")

  async function fetchCompra() {
    try {
      const response = await fetch(`/api/compras/${id}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Pedido nao encontrado.")
      }

      const payload = await response.json()
      setCompra(payload)
      setPrevisaoEntrega(payload.previsao_entrega ?? "")
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
    enabled: !saving,
    intervalMs: 10000,
  })

  async function handleSave() {
    const nextErrors: Record<string, string> = {}

    if (!previsaoEntrega) {
      nextErrors.previsao_entrega = "Informe a previsao de entrega para concluir o fechamento."
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/compras/${id}/confirmacao-fornecedor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previsao_entrega: previsaoEntrega,
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao confirmar pedido com o fornecedor.")
      }

      router.push("/autorizacoes")
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao confirmar pedido com o fornecedor.")
    } finally {
      setSaving(false)
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

  if (compra.etapa_fluxo !== "liberada_para_fornecedor") {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle>Pedido ainda nao liberado</CardTitle>
            <CardDescription>
              Este pedido ainda nao passou por todas as assinaturas necessarias para o fechamento com o fornecedor.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link href="/autorizacoes">
              <Button>Voltar para a fila</Button>
            </Link>
            <Link href={`/compras/${compra.id}`}>
              <Button variant="outline">Abrir pedido</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Link href="/autorizacoes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Fechamento do pedido #{compra.id}</h1>
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
            <CardTitle>Dados ja autorizados</CardTitle>
            <CardDescription>Numero e valor foram registrados pelo administrativo, e o financeiro ja deu ciencia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Fornecedor">
                <InfoValue>{compra.fornecedor}</InfoValue>
              </Field>
              <Field label="Numero do pedido">
                <InfoValue>{compra.numero_pedido || "Nao informado"}</InfoValue>
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Valor autorizado">
                <InfoValue>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(Number(compra.valor_total ?? 0))}
                </InfoValue>
              </Field>
              <Field label="Financeiro">
                <InfoValue>{compra.aprovado_financeiro_por || "Sem registro"}</InfoValue>
              </Field>
            </div>
            <Field label="Descricao">
              <div className="rounded-lg border bg-muted/15 p-4 text-sm leading-6 text-foreground">{compra.descricao}</div>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confirmacao com o fornecedor</CardTitle>
            <CardDescription>
              Depois de confirmar disponibilidade, pagamento e fechamento do pedido, informe a previsao de entrega.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Previsao de entrega *">
              <Input
                type="date"
                value={previsaoEntrega}
                onChange={(event) => {
                  setPrevisaoEntrega(event.target.value)
                  setErrors((current) => ({ ...current, previsao_entrega: "" }))
                }}
                className={errors.previsao_entrega ? "border-destructive" : ""}
              />
              {errors.previsao_entrega && <p className="text-sm text-destructive">{errors.previsao_entrega}</p>}
            </Field>

            <div className="rounded-lg border bg-muted/15 p-4 text-sm text-muted-foreground">
              Ao salvar, o pedido passa para <strong>Pedido autorizado</strong> e entra no fluxo normal de entregas.
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <Link href="/autorizacoes">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Salvando..." : "Confirmar pedido"}
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
