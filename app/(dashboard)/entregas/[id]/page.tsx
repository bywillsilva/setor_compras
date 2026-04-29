"use client"

import { use, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RotateCcw, Save, Truck } from "lucide-react"
import { DeliveryStatusBadge } from "@/components/compras/delivery-status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getDeliverySituation, STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/domain"
import type { Compra } from "@/lib/types"

interface CompraDetalhe extends Compra {
  historico: Array<{ id: number; evento: string; data: string }>
}

export default function EntregaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [compra, setCompra] = useState<CompraDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [formData, setFormData] = useState({
    data_entrega_real: "",
  })

  useEffect(() => {
    async function fetchCompra() {
      try {
        const response = await fetch(`/api/compras/${id}`)
        if (!response.ok) {
          throw new Error("Compra nao encontrada.")
        }

        const payload = await response.json()
        setCompra(payload)
        setFormData({
          data_entrega_real: payload.data_entrega_real ?? "",
        })
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    fetchCompra()
  }, [id])

  const situacao = useMemo(() => (compra ? getDeliverySituation(compra) : "pendente"), [compra])

  async function handleSave() {
    if (!formData.data_entrega_real) {
      alert("Informe a data em que o material chegou.")
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/compras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status_entrega: "entregue",
          data_entrega_real: formData.data_entrega_real,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao salvar entrega.")
      }

      router.push("/entregas")
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar entrega.")
    } finally {
      setSaving(false)
    }
  }

  async function handleReturnToPending() {
    if (!compra || compra.status_entrega !== "entregue") {
      return
    }

    if (!confirm("Deseja cancelar este registro de entrega e voltar o pedido para pendente?")) {
      return
    }

    setReverting(true)

    try {
      const response = await fetch(`/api/compras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status_entrega: "pendente",
          data_entrega_real: null,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao voltar entrega para pendente.")
      }

      router.push("/entregas")
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao voltar entrega para pendente.")
    } finally {
      setReverting(false)
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
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Pedido nao encontrado</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (compra.status !== "pedido_autorizado") {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle>Pedido ainda nao autorizado</CardTitle>
            <CardDescription>
              Antes de acompanhar a entrega, finalize a etapa de autorizacao deste pedido.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link href={`/autorizacoes/${compra.id}`}>
              <Button>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Autorizar pedido
              </Button>
            </Link>
            <Link href={`/compras/${compra.id}`}>
              <Button variant="outline">Voltar ao pedido</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isDelivered = compra.status_entrega === "entregue"

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/entregas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">Controle de entrega do pedido #{compra.id}</h1>
              <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
              <DeliveryStatusBadge
                compra={{
                  ...compra,
                  status_entrega: formData.data_entrega_real ? "entregue" : compra.status_entrega,
                  data_entrega_real: formData.data_entrega_real || compra.data_entrega_real,
                }}
              />
            </div>
            <p className="text-muted-foreground">
              {compra.cliente_nome} - {compra.proposta_nome}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/autorizacoes/${compra.id}`}>
            <Button variant="outline">Revisar autorizacao</Button>
          </Link>
          <Link href={`/compras/${compra.id}`}>
            <Button variant="outline">Voltar ao pedido</Button>
          </Link>
        </div>
      </div>

      {situacao === "atrasado" && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Entrega em atraso</p>
              <p className="text-sm text-muted-foreground">
                Atualize o status ou reprograme a previsao para manter o acompanhamento organizado.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Registro de entrega
            </CardTitle>
            <CardDescription>
              Registre a chegada do material quando a entrega acontecer. Se houver engano, voce pode voltar o pedido para pendente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Fornecedor">
                <InfoValue>{compra.fornecedor}</InfoValue>
              </Field>
              <Field label="Numero do pedido">
                <InfoValue>{compra.numero_pedido || "-"}</InfoValue>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Previsao registrada">
                <InfoValue>
                  {compra.previsao_entrega
                    ? format(parseISO(compra.previsao_entrega), "dd/MM/yyyy", { locale: ptBR })
                    : "-"}
                </InfoValue>
              </Field>

              <Field label="Status atual da entrega">
                <InfoValue>{compra.status_entrega === "entregue" ? "Entregue" : "Pendente"}</InfoValue>
              </Field>
            </div>

            <Field label="Data em que o material chegou">
              <Input
                type="date"
                value={formData.data_entrega_real}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, data_entrega_real: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Ao salvar esta data, o pedido passa automaticamente para entregue. Se precisar corrigir depois, volte o pedido para pendente.
              </p>
            </Field>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              {isDelivered && (
                <Button variant="outline" onClick={handleReturnToPending} disabled={saving || reverting}>
                  {reverting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Voltando...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Voltar para pendente
                    </>
                  )}
                </Button>
              )}
              <Link href="/entregas">
                <Button variant="outline">Cancelar</Button>
              </Link>
              <Button onClick={handleSave} disabled={saving || reverting}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isDelivered ? "Atualizar data de chegada" : "Registrar entrega"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo logistico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SummaryLine label="Cliente" value={compra.cliente_nome ?? "-"} />
              <SummaryLine label="Proposta" value={compra.proposta_nome ?? "-"} />
              <SummaryLine
                label="Valor"
                value={
                  compra.valor_total
                    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(compra.valor_total))
                    : "-"
                }
              />
              <SummaryLine
                label="Previsao atual"
                value={
                  compra.previsao_entrega
                    ? format(parseISO(compra.previsao_entrega), "dd/MM/yyyy", { locale: ptBR })
                    : "-"
                }
              />
              <SummaryLine
                label="Data real"
                value={
                  compra.data_entrega_real
                    ? format(parseISO(compra.data_entrega_real), "dd/MM/yyyy", { locale: ptBR })
                    : "-"
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regras desta etapa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Somente pedidos autorizados entram no fluxo de entregas.</p>
              <p>A previsao de entrega ja vem definida na autorizacao e fica aqui apenas como referencia.</p>
              <p>Ao registrar a data real de chegada, o sistema atualiza o pedido para entregue e alimenta o historico.</p>
              <p>Se a entrega for marcada por engano, voce pode reabrir esta etapa e voltar o pedido para pendente.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function InfoValue({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm font-medium">{children}</div>
}

function SummaryLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
