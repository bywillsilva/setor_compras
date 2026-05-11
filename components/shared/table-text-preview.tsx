"use client"

import { cn } from "@/lib/utils"

type TableTextPreviewProps = {
  text: string | null | undefined
  fallback?: string
  className?: string
}

export function TableTextPreview({
  text,
  fallback = "Sem descricao",
  className,
}: TableTextPreviewProps) {
  const content = text?.trim() || fallback

  return (
    <div title={content} className={cn("max-w-[220px] truncate text-xs text-muted-foreground", className)}>
      {content}
    </div>
  )
}
