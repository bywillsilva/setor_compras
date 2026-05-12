import type { AppFeature, PerfilPermissao, PerfilUsuario } from "@/lib/types"

export type { AppFeature } from "@/lib/types"

export const PERFIL_LABELS: Record<PerfilUsuario, string> = {
  admin: "Administrador",
  comprador: "Comprador",
  orcamentista: "Orcamentista",
  solicitante: "Solicitante",
  financeiro: "Financeiro",
}

export const ALL_APP_FEATURES: AppFeature[] = [
  "dashboard",
  "solicitacoes",
  "clientes",
  "propostas",
  "compras",
  "autorizacoes",
  "solicitacoes_autorizacao",
  "financeiro",
  "entregas",
  "orcamentos",
  "configuracoes",
  "usuarios",
  "editar_compra",
  "editar_proposta",
  "revisar_entrega",
  "solicitar_autorizacao",
]

export const FEATURE_LABELS: Record<AppFeature, string> = {
  dashboard: "Dashboard",
  solicitacoes: "Solicitacoes",
  clientes: "Clientes",
  propostas: "Propostas",
  compras: "Compras",
  autorizacoes: "Autorizacoes",
  solicitacoes_autorizacao: "Aprovacao ADM",
  financeiro: "Financeiro",
  entregas: "Entregas",
  orcamentos: "Orcamentos",
  configuracoes: "Configuracoes",
  usuarios: "Usuarios",
  editar_compra: "Editar compras",
  editar_proposta: "Editar propostas",
  revisar_entrega: "Revisar entrega",
  solicitar_autorizacao: "Solicitar autorizacao",
}

export const FEATURE_DESCRIPTIONS: Record<AppFeature, string> = {
  dashboard: "Visualizar indicadores e resumo geral.",
  solicitacoes: "Registrar e acompanhar solicitacoes de compra.",
  clientes: "Consultar clientes e resumos vinculados.",
  propostas: "Consultar propostas e obras.",
  compras: "Acompanhar os pedidos de compra.",
  autorizacoes: "Acompanhar a fila de assinaturas e concluir o fechamento com o fornecedor.",
  solicitacoes_autorizacao: "Aprovar solicitacoes administrativas.",
  financeiro: "Registrar a ciencia financeira do pedido.",
  entregas: "Controlar previsao e recebimento das entregas.",
  orcamentos: "Lancar os previstos de materiais nas propostas.",
  configuracoes: "Abrir configuracoes administrativas do sistema.",
  usuarios: "Gerenciar usuarios e perfis.",
  editar_compra: "Permitir edicao dos dados gerais das compras.",
  editar_proposta: "Permitir edicao dos dados das propostas.",
  revisar_entrega: "Permitir corrigir previsao e registro de entrega.",
  solicitar_autorizacao: "Permitir enviar compra para aprovacao.",
}

export const FEATURE_GROUPS: Array<{
  id: "modulos" | "acoes"
  label: string
  features: AppFeature[]
}> = [
  {
    id: "modulos",
    label: "Modulos",
    features: [
      "dashboard",
      "solicitacoes",
      "clientes",
      "propostas",
      "compras",
      "autorizacoes",
      "solicitacoes_autorizacao",
      "financeiro",
      "entregas",
      "orcamentos",
      "configuracoes",
      "usuarios",
    ],
  },
  {
    id: "acoes",
    label: "Acoes complementares",
    features: ["editar_compra", "editar_proposta", "revisar_entrega", "solicitar_autorizacao"],
  },
]

export const LOCKED_ADMIN_FEATURES: AppFeature[] = ["dashboard", "configuracoes", "usuarios"]

export const DEFAULT_FEATURE_MATRIX: Record<PerfilUsuario, AppFeature[]> = {
  admin: [
    "dashboard",
    "solicitacoes",
    "clientes",
    "propostas",
    "compras",
    "autorizacoes",
    "solicitacoes_autorizacao",
    "financeiro",
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
  solicitante: ["solicitacoes"],
  financeiro: ["financeiro"],
}

const FEATURE_PATH_ORDER: AppFeature[] = [
  "dashboard",
  "clientes",
  "propostas",
  "solicitacoes",
  "compras",
  "autorizacoes",
  "solicitacoes_autorizacao",
  "financeiro",
  "entregas",
  "orcamentos",
  "configuracoes",
]

const FEATURE_PATHS: Partial<Record<AppFeature, string>> = {
  dashboard: "/",
  solicitacoes: "/solicitacoes",
  clientes: "/clientes",
  propostas: "/propostas",
  compras: "/compras",
  autorizacoes: "/autorizacoes",
  solicitacoes_autorizacao: "/solicitacoes-autorizacao",
  financeiro: "/financeiro",
  entregas: "/entregas",
  orcamentos: "/orcamentos",
  configuracoes: "/configuracoes",
}

export function getDefaultFeaturesForPerfil(perfil: PerfilUsuario) {
  return [...DEFAULT_FEATURE_MATRIX[perfil]]
}

export function normalizeFeatureList(features: AppFeature[] | null | undefined, perfil?: PerfilUsuario) {
  const allowed = new Set<AppFeature>()

  for (const feature of features ?? []) {
    if (ALL_APP_FEATURES.includes(feature)) {
      allowed.add(feature)
    }
  }

  if (perfil === "admin") {
    for (const feature of LOCKED_ADMIN_FEATURES) {
      allowed.add(feature)
    }
  }

  return ALL_APP_FEATURES.filter((feature) => allowed.has(feature))
}

export function buildFeatureMatrix(records: PerfilPermissao[]) {
  const matrix = Object.fromEntries(
    (Object.keys(PERFIL_LABELS) as PerfilUsuario[]).map((perfil) => [perfil, new Set<AppFeature>()]),
  ) as Record<PerfilUsuario, Set<AppFeature>>

  for (const record of records) {
    if (!record.permitido) {
      continue
    }

    matrix[record.perfil]?.add(record.feature)
  }

  return Object.fromEntries(
    (Object.keys(PERFIL_LABELS) as PerfilUsuario[]).map((perfil) => [
      perfil,
      normalizeFeatureList(Array.from(matrix[perfil]), perfil),
    ]),
  ) as Record<PerfilUsuario, AppFeature[]>
}

export function getDefaultFeatureMatrix() {
  return Object.fromEntries(
    (Object.keys(DEFAULT_FEATURE_MATRIX) as PerfilUsuario[]).map((perfil) => [
      perfil,
      normalizeFeatureList(DEFAULT_FEATURE_MATRIX[perfil], perfil),
    ]),
  ) as Record<PerfilUsuario, AppFeature[]>
}

export function hasFeatureAccess(
  perfil: PerfilUsuario,
  feature: AppFeature,
  availableFeatures?: AppFeature[] | null,
) {
  const features = normalizeFeatureList(availableFeatures ?? DEFAULT_FEATURE_MATRIX[perfil], perfil)
  return features.includes(feature)
}

export function getDefaultPathForPerfil(perfil: PerfilUsuario, availableFeatures?: AppFeature[] | null) {
  const features = normalizeFeatureList(availableFeatures ?? DEFAULT_FEATURE_MATRIX[perfil], perfil)

  for (const feature of FEATURE_PATH_ORDER) {
    const path = FEATURE_PATHS[feature]
    if (path && features.includes(feature)) {
      return path
    }
  }

  return "/auth/login"
}

export function getFeatureForPath(pathname: string): AppFeature | null {
  if (pathname === "/") {
    return "dashboard"
  }

  if (pathname.startsWith("/atualizacoes")) {
    return "dashboard"
  }

  if (pathname.startsWith("/solicitacoes-autorizacao")) {
    return "solicitacoes_autorizacao"
  }

  if (pathname.startsWith("/clientes")) {
    return "clientes"
  }

  if (pathname.startsWith("/solicitacoes")) {
    return "solicitacoes"
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

  if (pathname.startsWith("/financeiro")) {
    return "financeiro"
  }

  if (pathname.startsWith("/entregas")) {
    return "entregas"
  }

  if (pathname.startsWith("/configuracoes")) {
    return "configuracoes"
  }

  return null
}
