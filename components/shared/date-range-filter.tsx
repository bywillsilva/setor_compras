"use client"

import { CalendarRange, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type DateRangeFilterProps = {
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onClear: () => void
  startLabel?: string
  endLabel?: string
}

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  startLabel = "De",
  endLabel = "Ate",
}: DateRangeFilterProps) {
  const hasActiveFilter = Boolean(startDate || endDate)

  return (
    <div className="flex items-center justify-start">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-8 gap-2 px-2 ${hasActiveFilter ? "text-foreground" : "text-muted-foreground"}`}
          >
            <CalendarRange className="h-4 w-4" />
            {hasActiveFilter ? `${startDate || "Inicio"} ate ${endDate || "Hoje"}` : "Filtrar por data"}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[320px] space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Filtrar por data</p>
            <p className="text-xs text-muted-foreground">Defina um periodo apenas quando precisar refinar a consulta.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">{startLabel}</span>
              <Input type="date" value={startDate} onChange={(event) => onStartDateChange(event.target.value)} />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">{endLabel}</span>
              <Input type="date" value={endDate} onChange={(event) => onEndDateChange(event.target.value)} />
            </label>
          </div>

          {hasActiveFilter && (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
