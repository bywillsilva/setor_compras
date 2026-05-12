"use client"

import { Trash2 } from "lucide-react"
import { TableTextPreview } from "@/components/shared/table-text-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export type ContractSummaryDisplayItem = {
  proposta_id: number
  cliente_nome: string
  proposta_nome: string
  valor_real_gasto: number
  valor_contrato: number | string
}

export function ContractSummaryItems({
  items,
  editable = false,
  emptyLabel = "Nenhuma obra adicionada ainda.",
  onContractValueChange,
  onRemove,
}: {
  items: ContractSummaryDisplayItem[]
  editable?: boolean
  emptyLabel?: string
  onContractValueChange?: (propostaId: number, value: string) => void
  onRemove?: (propostaId: number) => void
}) {
  if (items.length === 0) {
    return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{emptyLabel}</div>
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const valorContratoNumber =
          typeof item.valor_contrato === "string" ? Number(item.valor_contrato || 0) : Number(item.valor_contrato || 0)
        const valorContratoInput = typeof item.valor_contrato === "string" ? item.valor_contrato : String(item.valor_contrato)
        const lucroBruto = valorContratoNumber - item.valor_real_gasto

        return (
          <div key={item.proposta_id} className="rounded-2xl border border-border/70 bg-muted/15 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-medium">{item.cliente_nome}</div>
                <TableTextPreview text={item.proposta_nome} className="max-w-[320px]" />
                <Badge variant="outline">Real atual: {formatCurrency(item.valor_real_gasto)}</Badge>
              </div>
              {editable && onRemove ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(item.proposta_id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </Button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Valor real gasto</div>
                <div className="mt-2 font-semibold">{formatCurrency(item.valor_real_gasto)}</div>
              </div>

              {editable && onContractValueChange ? (
                <label className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contrato fechado</div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorContratoInput}
                    onChange={(event) => onContractValueChange(item.proposta_id, event.target.value)}
                    placeholder="0,00"
                    className="mt-2"
                  />
                </label>
              ) : (
                <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contrato fechado</div>
                  <div className="mt-2 font-semibold">{formatCurrency(valorContratoNumber)}</div>
                </div>
              )}

              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lucro bruto</div>
                <div className={`mt-2 font-semibold ${lucroBruto < 0 ? "text-red-500 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                  {formatCurrency(lucroBruto)}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
