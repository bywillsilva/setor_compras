"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { ComparativoMensal } from "@/lib/types"

interface DashboardChartProps {
  data: ComparativoMensal[]
}

export function DashboardChart({ data }: DashboardChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      name: format(parseISO(`${item.mes}-01`), "MMM", { locale: ptBR }),
      previsto: Number(item.previsto),
      realizado: Number(item.realizado),
    }))
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        <p>Nenhum dado disponível</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} barGap={10}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/70" />
        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) =>
            new Intl.NumberFormat("pt-BR", {
              notation: "compact",
              compactDisplay: "short",
            }).format(Number(value))
          }
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(value),
            name === "previsto" ? "Previsto" : "Realizado",
          ]}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
          }}
        />
        <Legend formatter={(value) => (value === "previsto" ? "Previsto" : "Realizado")} />
        <Bar dataKey="previsto" fill="#1E3A8A" radius={[6, 6, 0, 0]} />
        <Bar dataKey="realizado" fill="#3B82F6" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
