import type { TemaPreferido } from "@/lib/types"

export const THEME_COOKIE_NAME = "setor_compras_theme"
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function normalizeThemePreference(value: unknown): TemaPreferido {
  return value === "escuro" ? "escuro" : "claro"
}

export function themePreferenceToNextTheme(preference: TemaPreferido) {
  return preference === "escuro" ? "dark" : "light"
}

export function nextThemeToThemePreference(theme: string | null | undefined): TemaPreferido {
  return theme === "dark" ? "escuro" : "claro"
}
