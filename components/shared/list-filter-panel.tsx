"use client"

import type { ReactNode } from "react"

type ListFilterPanelProps = {
  children: ReactNode
  trailing?: ReactNode
}

export function ListFilterPanel({ children, trailing }: ListFilterPanelProps) {
  return (
    <div className="mb-4 rounded-2xl border border-border/70 bg-card/90 p-3 shadow-[0_8px_24px_-22px_rgba(15,23,42,0.25)] sm:p-4">
      <div className="space-y-4">
        {children}
        {trailing ? <div className="flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start">{trailing}</div> : null}
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
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
