"use client"

import type { ReactNode } from "react"

type ListFilterPanelProps = {
  children: ReactNode
  trailing?: ReactNode
}

export function ListFilterPanel({ children, trailing }: ListFilterPanelProps) {
  return (
    <div className="mb-4 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-[0_8px_24px_-22px_rgba(15,23,42,0.25)]">
      <div className="space-y-4">
        {children}
        {trailing ? <div className="flex flex-wrap items-center justify-start gap-2 border-t border-border/70 pt-3">{trailing}</div> : null}
      </div>
    </div>
  )
}

type ListFilterGridProps = {
  children: ReactNode
  columns?: string
}

export function ListFilterGrid({
  children,
  columns = "grid gap-3 md:grid-cols-2 xl:grid-cols-4",
}: ListFilterGridProps) {
  return <div className={columns}>{children}</div>
}

type ListFilterFieldProps = {
  label: string
  children: ReactNode
}

export function ListFilterField({ label, children }: ListFilterFieldProps) {
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
