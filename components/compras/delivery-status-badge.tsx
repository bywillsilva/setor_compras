"use client"

import { differenceInCalendarDays, parseISO } from "date-fns"
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getDeliverySituation } from "@/lib/domain"
import type { Compra } from "@/lib/types"

export function DeliveryStatusBadge({ compra }: { compra: Compra }) {
  const situacao = getDeliverySituation(compra)

  if (situacao === "entregue") {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-50">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Entregue
      </Badge>
    )
  }

  if (situacao === "atrasado" && compra.previsao_entrega) {
    const dias = differenceInCalendarDays(new Date(), parseISO(compra.previsao_entrega))
    return (
      <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-400/40 dark:bg-red-500/20 dark:text-red-50">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Atrasado {dias}d
      </Badge>
    )
  }

  if (situacao === "proximo" && compra.previsao_entrega) {
    const dias = differenceInCalendarDays(parseISO(compra.previsao_entrega), new Date())
    return (
      <Badge className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-50">
        <Clock className="mr-1 h-3 w-3" />
        {dias <= 0 ? "Hoje" : `${dias}d`}
      </Badge>
    )
  }

  if (situacao === "no_prazo") {
    return (
      <Badge className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-50">
        <Clock className="mr-1 h-3 w-3" />
        Dentro do prazo
      </Badge>
    )
  }

  return <span className="text-sm text-muted-foreground">-</span>
}
