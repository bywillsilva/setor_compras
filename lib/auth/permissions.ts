import type { PerfilUsuario } from "@/lib/types"

export type AppFeature =
  | "dashboard"
  | "clientes"
  | "propostas"
  | "compras"
  | "autorizacoes"
  | "entregas"
  | "orcamentos"
  | "configuracoes"
  | "usuarios"
  | "editar_compra"
  | "editar_proposta"
  | "revisar_entrega"
  | "solicitar_autorizacao"

export const PERFIL_LABELS: Record<PerfilUsuario, string> = {
  admin: "Administrador",
  comprador: "Comprador",
  orcamentista: "Orcamentista",
}

const FEATURE_MATRIX: Record<PerfilUsuario, AppFeature[]> = {
  admin: [
    "dashboard",
    "clientes",
    "propostas",
    "compras",
    "autorizacoes",
    "entregas",
    "orcamentos",
    "configuracoes",
    "usuarios",
    "editar_compra",
    "editar_proposta",
    "revisar_entrega",
    "solicitar_autorizacao",
  ],
  comprador: [
    "dashboard",
    "clientes",
    "propostas",
    "compras",
    "autorizacoes",
    "entregas",
    "editar_compra",
    "editar_proposta",
    "revisar_entrega",
    "solicitar_autorizacao",
  ],
  orcamentista: ["orcamentos"],
}

export function hasFeatureAccess(perfil: PerfilUsuario, feature: AppFeature) {
  return FEATURE_MATRIX[perfil].includes(feature)
}

export function getDefaultPathForPerfil(perfil: PerfilUsuario) {
  return perfil === "orcamentista" ? "/orcamentos" : "/"
}

export function getFeatureForPath(pathname: string): AppFeature | null {
  if (pathname === "/") {
    return "dashboard"
  }

  if (pathname.startsWith("/clientes")) {
    return "clientes"
  }

  if (pathname.startsWith("/propostas")) {
    return "propostas"
  }

  if (pathname.startsWith("/orcamentos")) {
    return "orcamentos"
  }

  if (pathname.startsWith("/compras")) {
    return "compras"
  }

  if (pathname.startsWith("/autorizacoes")) {
    return "autorizacoes"
  }

  if (pathname.startsWith("/entregas")) {
    return "entregas"
  }
  if (pathname.startsWith("/configuracoes")) {
    return "configuracoes"
  }

  return null
}
