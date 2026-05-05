"use client"

import { CATEGORIA_LABELS, COMPRA_RATEIO_OPTIONS } from "@/lib/domain"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type CompraRateioFormState = {
  valor_categoria_perfis: string
  valor_categoria_vidros: string
  valor_categoria_acessorios: string
  valor_categoria_perdas: string
  valor_categoria_outros: string
}

type Props = {
  values: CompraRateioFormState
  onChange: (field: keyof CompraRateioFormState, value: string) => void
  description?: string
}

export function CompraRateioFields({ values, onChange, description }: Props) {
  const totalRateado =
    toNumber(values.valor_categoria_perfis) +
    toNumber(values.valor_categoria_vidros) +
    toNumber(values.valor_categoria_acessorios) +
    toNumber(values.valor_categoria_perdas) +
    toNumber(values.valor_categoria_outros)

  return (
    <div className="space-y-4 rounded-xl border bg-muted/15 p-4">
      <div className="space-y-1">
        <h3 className="font-medium text-foreground">Distribuicao por categoria</h3>
        <p className="text-sm text-muted-foreground">
          {description ?? "Informe quanto desta compra pertence a cada categoria de material."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {COMPRA_RATEIO_OPTIONS.map((categoria) => {
          const field = getFieldName(categoria)

          return (
            <div key={categoria} className="rounded-xl border bg-background p-4">
              <div className="space-y-1">
                <Label>{CATEGORIA_LABELS[categoria]}</Label>
                <p className="text-xs text-muted-foreground">
                  {categoria === "perdas"
                    ? "Use para reposicoes e materiais gerados por perdas."
                    : categoria === "outros"
                      ? "Itens complementares fora das categorias principais."
                      : `Lancamentos relacionados a ${CATEGORIA_LABELS[categoria].toLowerCase()}.`}
                </p>
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={values[field]}
                onChange={(event) => onChange(field, event.target.value)}
                className="mt-3"
              />
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border bg-background px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">Total rateado</span>
          <span className="font-medium">{formatCurrency(totalRateado)}</span>
        </div>
      </div>
    </div>
  )
}

function getFieldName(categoria: (typeof COMPRA_RATEIO_OPTIONS)[number]) {
  switch (categoria) {
    case "perfis":
      return "valor_categoria_perfis" as const
    case "vidros":
      return "valor_categoria_vidros" as const
    case "acessorios":
      return "valor_categoria_acessorios" as const
    case "perdas":
      return "valor_categoria_perdas" as const
    default:
      return "valor_categoria_outros" as const
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
