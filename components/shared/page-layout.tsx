"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[2rem]">{title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
    </div>
  )
}

export function SummaryMetricCard({
  title,
  value,
  description,
  tone = "default",
}: {
  title: string
  value: number | string
  description: string
  tone?: "default" | "warning" | "danger"
}) {
  return (
    <Card
      className={cn(
        "border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,245,255,0.94))] dark:bg-[linear-gradient(180deg,rgba(15,34,71,0.98),rgba(11,27,59,0.96))]",
        tone === "warning" &&
          "border-amber-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,221,0.94))] dark:border-amber-500/30 dark:bg-[linear-gradient(180deg,rgba(58,43,15,0.95),rgba(44,32,11,0.92))]",
        tone === "danger" &&
          "border-red-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,237,237,0.94))] dark:border-red-500/30 dark:bg-[linear-gradient(180deg,rgba(61,23,29,0.95),rgba(48,18,24,0.92))]",
      )}
    >
      <CardHeader className="pb-1">
        <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90">
          {title}
        </CardDescription>
        <CardTitle className="text-3xl tracking-tight text-foreground md:text-[2rem]">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm leading-5 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden border-border/80">
      <CardHeader className="border-b border-border/70 pb-4">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

export function FormSectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn("overflow-hidden border-border/80", className)}>
      <CardHeader className="border-b border-border/70 pb-4">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  )
}
