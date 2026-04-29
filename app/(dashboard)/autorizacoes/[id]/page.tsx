"use client"

import { use, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeft, CheckCircle2, Loader2, PackageCheck, Save, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/domain"
import type { Compra } from "@/lib/types"

interface CompraDetalhe extends Compra {
  historico: Array<{ id: number; evento: string; data: string }>
}

export default function AutorizacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [compra, setCompra] = useState<CompraDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    numero_pedido: "",
    valor_total: "",
    previsao_entrega: "",
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
          numero_pedido: payload.numero_pedido ?? "",
          valor_total: payload.valor_total?.toString() ?? "",
          previsao_entrega: payload.previsao_entrega ?? "",
        })
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    fetchCompra()
  }, [id])

  function validate() {
    const nextErrors: Record<string, string> = {}

    if (!formData.numero_pedido.trim()) {
      nextErrors.numero_pedido = "Numero do pedido obrigatorio para autorizar."
    }

    if (!formData.valor_total || Number(formData.valor_total) <= 0) {
      nextErrors.valor_total = "Valor total obrigatorio para autorizar."
    }

    if (!formData.previsao_entrega) {
      nextErrors.previsao_entrega = "Previsao de entrega obrigatoria para autorizar."
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
      const response = await fetch(`/api/compras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "pedido_autorizado",
          numero_pedido: formData.numero_pedido,
          valor_total: formData.valor_total ? Number(formData.valor_total) : null,
          previsao_entrega: formData.previsao_entrega || null,
        }),
      })

      const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error || "Erro ao salvar autorizacao.")
        }

      router.push(`/autorizacoes`)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar autorizacao.")
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
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Pedido nao encontrado</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const alreadyAuthorized = compra.status === "pedido_autorizado"

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/autorizacoes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">Autorizar pedido #{compra.id}</h1>
              <Badge className={STATUS_BADGE_CLASSES[compra.status]}>{STATUS_LABELS[compra.status]}</Badge>
            </div>
            <p className="text-muted-foreground">
              {compra.cliente_nome} - {compra.proposta_nome}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/compras/${compra.id}`}>
            <Button variant="outline">Voltar ao pedido</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5" />
                Dados da autorizacao
              </CardTitle>
              <CardDescription>
                Preencha os dados obrigatorios. Ao salvar, o pedido sera autorizado automaticamente e esta etapa sera concluida.
              </CardDescription>
            </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Fornecedor">
                <InfoValue>{compra.fornecedor}</InfoValue>
              </Field>
              <Field label="Criado em">
                <InfoValue>{format(new Date(compra.data_criacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}</InfoValue>
              </Field>
            </div>

            <Field label="Descricao da compra">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-6">{compra.descricao}</div>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Status atual">
                <InfoValue>{STATUS_LABELS[compra.status]}</InfoValue>
              </Field>

              <Field label="Numero do pedido">
                <Input
                  value={formData.numero_pedido}
                  onChange={(event) => {
                    setFormData((current) => ({ ...current, numero_pedido: event.target.value }))
                    setErrors((current) => ({ ...current, numero_pedido: "" }))
                  }}
                  className={errors.numero_pedido ? "border-destructive" : ""}
                  placeholder="Ex: PED-2026-014"
                />
                {errors.numero_pedido && <p className="text-sm text-destructive">{errors.numero_pedido}</p>}
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Valor total (R$)">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor_total}
                  onChange={(event) => {
                    setFormData((current) => ({ ...current, valor_total: event.target.value }))
                    setErrors((current) => ({ ...current, valor_total: "" }))
                  }}
                  className={errors.valor_total ? "border-destructive" : ""}
                />
                {errors.valor_total && <p className="text-sm text-destructive">{errors.valor_total}</p>}
              </Field>

              <Field label="Previsao de entrega">
                <Input
                  type="date"
                  value={formData.previsao_entrega}
                  onChange={(event) => {
                    setFormData((current) => ({ ...current, previsao_entrega: event.target.value }))
                    setErrors((current) => ({ ...current, previsao_entrega: "" }))
                  }}
                  className={errors.previsao_entrega ? "border-destructive" : ""}
                />
                {errors.previsao_entrega && <p className="text-sm text-destructive">{errors.previsao_entrega}</p>}
              </Field>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Link href="/autorizacoes">
                <Button variant="outline">Cancelar</Button>
              </Link>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    {alreadyAuthorized ? <Save className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    {alreadyAuthorized ? "Salvar autorizacao" : "Autorizar pedido"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Regras desta etapa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Para autorizar, informe numero do pedido, valor total e previsao de entrega.</p>
              <p>O status de autorizacao nao precisa ser escolhido manualmente nesta tela.</p>
              <p>O registro da entrega acontece depois, somente quando o material realmente chegar.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo atual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SummaryLine label="Cliente" value={compra.cliente_nome ?? "-"} />
              <SummaryLine label="Proposta" value={compra.proposta_nome ?? "-"} />
              <SummaryLine label="Status atual" value={STATUS_LABELS[compra.status]} />
              <SummaryLine label="Pedido no fornecedor" value={compra.numero_pedido || "-"} />
              <SummaryLine
                label="Valor atual"
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
