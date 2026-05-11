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
    <div
      title={content}
      className={cn("max-w-[220px] whitespace-normal break-words line-clamp-2 text-xs leading-5 text-muted-foreground", className)}
    >
      {content}
    </div>
  )
}
