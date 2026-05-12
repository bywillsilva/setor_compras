"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ComparativoMensal } from "@/lib/types"

interface DashboardChartProps {
  data: ComparativoMensal[]
}

const chartConfig = {
  previsto: {
    label: "Previsto",
    theme: {
      light: "#1E3A8A",
      dark: "#4A7BFF",
    },
  },
  realizado: {
    label: "Realizado",
    theme: {
      light: "#3B82F6",
      dark: "#78A7FF",
    },
  },
} satisfies ChartConfig

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
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
    <ChartContainer config={chartConfig} className="h-[320px] w-full aspect-auto">
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
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted) / 0.28)" }}
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{
                        backgroundColor:
                          item.color ??
                          (typeof item.payload === "object" &&
                          item.payload !== null &&
                          "fill" in item.payload &&
                          typeof item.payload.fill === "string"
                            ? item.payload.fill
                            : undefined),
                      }}
                    />
                    <span className="text-muted-foreground">
                      {name === "previsto" ? "Previsto" : "Realizado"}
                    </span>
                  </div>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {formatCurrency(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="previsto" fill="var(--color-previsto)" radius={[6, 6, 0, 0]} />
        <Bar dataKey="realizado" fill="var(--color-realizado)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
