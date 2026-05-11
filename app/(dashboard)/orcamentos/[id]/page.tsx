"use client"

import { use, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Proposta } from "@/lib/types"

type OrcamentoFormState = {
  valor_previsto_perfis: string
  valor_previsto_vidros: string
  valor_previsto_acessorios: string
  valor_previsto_outros: string
  custo_perdas: string
}

export default function OrcamentoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<OrcamentoFormState>(emptyForm())

  useEffect(() => {
    async function fetchOrcamento() {
      try {
        setLoading(true)
        const response = await fetch(`/api/orcamentos/${id}`)

        if (!response.ok) {
          throw new Error("Orcamento nao encontrado.")
        }

        const payload = await response.json()
        setProposta(payload)
        setFormData({
          valor_previsto_perfis: payload.valor_previsto_perfis?.toString() ?? "",
          valor_previsto_vidros: payload.valor_previsto_vidros?.toString() ?? "",
          valor_previsto_acessorios: payload.valor_previsto_acessorios?.toString() ?? "",
          valor_previsto_outros: payload.valor_previsto_outros?.toString() ?? "",
          custo_perdas: payload.custo_perdas?.toString() ?? "",
        })
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrcamento()
  }, [id])

  const totalCategorias = useMemo(
    () =>
      toNumber(formData.valor_previsto_perfis) +
      toNumber(formData.valor_previsto_vidros) +
      toNumber(formData.valor_previsto_acessorios) +
      toNumber(formData.valor_previsto_outros),
    [
      formData.valor_previsto_acessorios,
      formData.valor_previsto_outros,
      formData.valor_previsto_perfis,
      formData.valor_previsto_vidros,
    ],
  )

  const custoPerdas = toNumber(formData.custo_perdas)
  const totalBaseDistribuicao = totalCategorias > 0 ? totalCategorias : 1

  const distribuicao = [
    {
      label: "Perfis",
      value: toNumber(formData.valor_previsto_perfis),
      color: "bg-blue-600",
    },
    {
      label: "Vidros",
      value: toNumber(formData.valor_previsto_vidros),
      color: "bg-sky-500",
    },
    {
      label: "Acessorios",
      value: toNumber(formData.valor_previsto_acessorios),
      color: "bg-amber-500",
    },
    {
      label: "Outros",
      value: toNumber(formData.valor_previsto_outros),
      color: "bg-slate-500",
    },
  ]

  async function handleSave() {
    setSaving(true)

    try {
      const response = await fetch(`/api/orcamentos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor_previsto_perfis: toNumber(formData.valor_previsto_perfis),
          valor_previsto_vidros: toNumber(formData.valor_previsto_vidros),
          valor_previsto_acessorios: toNumber(formData.valor_previsto_acessorios),
          valor_previsto_outros: toNumber(formData.valor_previsto_outros),
          custo_perdas: toNumber(formData.custo_perdas),
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao salvar orcamento.")
      }

      router.push("/orcamentos")
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar orcamento.")
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

  if (!proposta) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Orcamento nao encontrado</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/orcamentos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{proposta.nome}</h1>
              {proposta.arquivado && <Badge variant="outline">Arquivada</Badge>}
            </div>
            <p className="text-muted-foreground">{proposta.cliente_nome}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href="/orcamentos">
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
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Valores previstos da obra</CardTitle>
            <CardDescription>
              Preencha as categorias principais da proposta. Perdas e reposicao ficam separadas como reserva eventual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <BudgetField
                label="Perfis"
                hint="Estruturas e perfis principais."
                value={formData.valor_previsto_perfis}
                onChange={(value) => setFormData((current) => ({ ...current, valor_previsto_perfis: value }))}
              />
              <BudgetField
                label="Vidros"
                hint="Itens de vidro e derivados."
                value={formData.valor_previsto_vidros}
                onChange={(value) => setFormData((current) => ({ ...current, valor_previsto_vidros: value }))}
              />
              <BudgetField
                label="Acessorios"
                hint="Ferragens, componentes e consumiveis."
                value={formData.valor_previsto_acessorios}
                onChange={(value) => setFormData((current) => ({ ...current, valor_previsto_acessorios: value }))}
              />
              <BudgetField
                label="Outros"
                hint="Itens complementares fora das categorias principais."
                value={formData.valor_previsto_outros}
                onChange={(value) => setFormData((current) => ({ ...current, valor_previsto_outros: value }))}
              />
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <StaticValue
                  label="Valor previsto total"
                  value={formatCurrency(totalCategorias)}
                  hint="Calculado automaticamente pela soma das categorias."
                />
                <Field label="Custo de perdas/reposicao">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.custo_perdas}
                    onChange={(event) => setFormData((current) => ({ ...current, custo_perdas: event.target.value }))}
                  />
                </Field>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo do lancamento</CardTitle>
              <CardDescription>Conferencia rapida do previsto principal e da reserva eventual de perdas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Total calculado
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{formatCurrency(totalCategorias)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Atualizado automaticamente conforme os valores das categorias.
                </p>
              </div>

              <SummaryLine label="Soma das categorias" value={formatCurrency(totalCategorias)} />
              <SummaryLine label="Perdas e reposicao" value={formatCurrency(custoPerdas)} />
              <SummaryLine label="Total projetado com perdas" value={formatCurrency(totalCategorias + custoPerdas)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuicao prevista</CardTitle>
              <CardDescription>Leitura simples da concentracao do previsto entre as categorias principais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {distribuicao.map((item) => {
                const percent = item.value > 0 ? (item.value / totalBaseDistribuicao) * 100 : 0

                return (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">{formatCurrency(item.value)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function BudgetField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Input type="number" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className="mt-3" />
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

function StaticValue({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-md border bg-background px-3 py-2.5">
        <div className="font-medium text-foreground">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function emptyForm(): OrcamentoFormState {
  return {
    valor_previsto_perfis: "",
    valor_previsto_vidros: "",
    valor_previsto_acessorios: "",
    valor_previsto_outros: "",
    custo_perdas: "",
  }
}

function toNumber(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}
