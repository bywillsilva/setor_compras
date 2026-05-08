"use client"

import type { ReactNode } from "react"

type ListFilterPanelProps = {
  children: ReactNode
  trailing?: ReactNode
}

export function ListFilterPanel({ children, trailing }: ListFilterPanelProps) {
  return (
    <div className="mb-4 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="space-y-3">
        {children}
        {trailing ? <div className="flex justify-end">{trailing}</div> : null}
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
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
