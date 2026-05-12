"use client"

import { MoonStar, SunMedium } from "lucide-react"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import type { TemaPreferido } from "@/lib/types"
import { cn } from "@/lib/utils"
import { nextThemeToThemePreference, themePreferenceToNextTheme } from "@/lib/theme"

export function ThemeModeToggle({ collapsed }: { collapsed: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentTheme = mounted ? nextThemeToThemePreference(resolvedTheme) : "claro"

  async function handleThemeChange(nextTheme: TemaPreferido) {
    if (nextTheme === currentTheme || saving) {
      return
    }

    const previousTheme = currentTheme
    setTheme(themePreferenceToNextTheme(nextTheme))
    setSaving(true)

    try {
      const response = await fetch("/api/usuarios/preferencias/tema", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema: nextTheme }),
      })

      if (!response.ok) {
        throw new Error("Nao foi possivel salvar sua preferencia de tema.")
      }
    } catch (error) {
      console.error(error)
      setTheme(themePreferenceToNextTheme(previousTheme))
    } finally {
      setSaving(false)
    }
  }

  if (collapsed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!mounted || saving}
        title={currentTheme === "escuro" ? "Alternar para tema claro" : "Alternar para tema escuro"}
        onClick={() => handleThemeChange(currentTheme === "escuro" ? "claro" : "escuro")}
        className="text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      >
        {currentTheme === "escuro" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      </Button>
    )
  }

  return (
    <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/18 p-2">
      <div className="mb-2 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/60">Tema</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!mounted || saving}
          onClick={() => handleThemeChange("claro")}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors",
            currentTheme === "claro"
              ? "border-white/10 bg-white/95 text-slate-900 shadow-sm"
              : "border-transparent bg-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
          )}
        >
          <SunMedium className="h-4 w-4" />
          Claro
        </button>
        <button
          type="button"
          disabled={!mounted || saving}
          onClick={() => handleThemeChange("escuro")}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors",
            currentTheme === "escuro"
              ? "border-white/10 bg-white/10 text-white shadow-sm"
              : "border-transparent bg-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
          )}
        >
          <MoonStar className="h-4 w-4" />
          Escuro
        </button>
      </div>
    </div>
  )
}
