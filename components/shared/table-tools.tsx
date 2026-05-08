"use client"

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SortDirection = "asc" | "desc"

export function nextSortDirection(
  currentColumn: string,
  activeColumn: string,
  activeDirection: SortDirection,
): SortDirection {
  if (currentColumn !== activeColumn) {
    return "asc"
  }

  return activeDirection === "asc" ? "desc" : "asc"
}

export function SortableTableHead({
  label,
  isActive,
  direction,
  onClick,
  className,
}: {
  label: string
  isActive: boolean
  direction: SortDirection
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn("h-auto px-0 py-0 text-left font-medium hover:bg-transparent", className)}
    >
      <span>{label}</span>
      {isActive ? (
        direction === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />
      )}
    </Button>
  )
}

export function TableFilterInput({
  value,
  onChange,
  placeholder,
  className,
  type = "text",
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
  type?: "text" | "date"
}) {
  return (
    <Input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={cn("h-8 min-w-0 text-xs", className)}
    />
  )
}
