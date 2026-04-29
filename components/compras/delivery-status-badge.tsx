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
      <Badge className="bg-emerald-100 text-emerald-800">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Entregue
      </Badge>
    )
  }

  if (situacao === "atrasado" && compra.previsao_entrega) {
    const dias = differenceInCalendarDays(new Date(), parseISO(compra.previsao_entrega))
    return (
      <Badge className="bg-red-100 text-red-800">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Atrasado {dias}d
      </Badge>
    )
  }

  if (situacao === "proximo" && compra.previsao_entrega) {
    const dias = differenceInCalendarDays(parseISO(compra.previsao_entrega), new Date())
    return (
      <Badge className="bg-amber-100 text-amber-800">
        <Clock className="mr-1 h-3 w-3" />
        {dias <= 0 ? "Hoje" : `${dias}d`}
      </Badge>
    )
  }

  if (situacao === "no_prazo") {
    return (
      <Badge className="bg-blue-100 text-blue-800">
        <Clock className="mr-1 h-3 w-3" />
        Dentro do prazo
      </Badge>
    )
  }

  return <span className="text-sm text-muted-foreground">-</span>
}
