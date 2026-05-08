"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { hasFeatureAccess, PERFIL_LABELS } from "@/lib/auth/permissions"
import type { AppFeature, PerfilUsuario } from "@/lib/types"
import { cn } from "@/lib/utils"

type NavigationItem = {
  name: string
  href: string
  icon: typeof LayoutDashboard
  feature: AppFeature
  exact?: boolean
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, feature: "dashboard" },
  { name: "Clientes", href: "/clientes", icon: Users, feature: "clientes" },
  { name: "Propostas", href: "/propostas", icon: FileText, feature: "propostas" },
  { name: "Solicitacoes", href: "/solicitacoes", icon: ClipboardList, feature: "solicitacoes" },
  { name: "Compras", href: "/compras", icon: ShoppingCart, feature: "compras" },
  { name: "Aprovacao ADM", href: "/solicitacoes-autorizacao", icon: CheckCircle2, feature: "solicitacoes_autorizacao" },
  { name: "Financeiro", href: "/financeiro", icon: Landmark, feature: "financeiro" },
  { name: "Entregas", href: "/entregas", icon: Truck, feature: "entregas" },
  { name: "Orcamentos", href: "/orcamentos", icon: Calculator, feature: "orcamentos" },
]

const ADMIN_FOOTER_ITEMS = [
  {
    name: "Fila administrativa",
    href: "/configuracoes/solicitacoes-sensiveis",
    icon: ShieldCheck,
  },
]

export function AppSidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const pathname = usePathname()
  const session = useCurrentSession()
  const [loggingOut, setLoggingOut] = useState(false)

  if (!session) {
    return null
  }

  const navigation = getNavigation(session.perfil, session.features)

  async function handleLogout() {
    setLoggingOut(true)

    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      window.location.href = "/auth/login"
    }
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 hidden h-screen bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out md:block",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <div className="flex h-full flex-col">
        <div className={cn("flex h-16 items-center border-b border-sidebar-border", collapsed ? "justify-center px-3" : "gap-3 px-4")}>
          <div className="flex items-center gap-3 overflow-hidden">
            <Package className="h-8 w-8 shrink-0" />
            {!collapsed && (
              <div>
                <h1 className="text-lg font-semibold">Compras</h1>
                <p className="text-xs text-sidebar-foreground/70">{PERFIL_LABELS[session.perfil]}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              collapsed && "absolute right-2 top-4",
            )}
            aria-label={collapsed ? "Expandir menu" : "Minimizar menu"}
            title={collapsed ? "Expandir menu" : "Minimizar menu"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = isSidebarItemActive(pathname, item.href, item.exact)

            return (
              <Link
                key={item.name}
                href={item.href}
                title={collapsed ? item.name : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {session.perfil === "admin" &&
            ADMIN_FOOTER_ITEMS.map((item) => {
              const isActive = isSidebarItemActive(pathname, item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    "flex rounded-lg text-sm transition-colors",
                    collapsed ? "justify-center px-2 py-3" : "items-center gap-3 px-3 py-2",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && item.name}
                </Link>
              )
            })}

          {hasFeatureAccess(session.perfil, "configuracoes", session.features) && (
            <Link
              href="/configuracoes"
              title={collapsed ? "Configuracoes" : undefined}
              className={cn(
                "flex rounded-lg text-sm transition-colors",
                collapsed ? "justify-center px-2 py-3" : "items-center gap-3 px-3 py-2",
                isSidebarItemActive(pathname, "/configuracoes", true)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Settings className="h-5 w-5 shrink-0" />
              {!collapsed && "Configuracoes"}
            </Link>
          )}

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title={collapsed ? "Sair" : undefined}
            className={cn(
              "mt-2 flex w-full rounded-lg text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground disabled:opacity-60",
              collapsed ? "justify-center px-2 py-3" : "items-center gap-3 px-3 py-2",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && (loggingOut ? "Saindo..." : "Sair")}
          </button>
        </div>
      </div>
    </aside>
  )
}

function getNavigation(perfil: PerfilUsuario, features: AppFeature[]) {
  return NAVIGATION_ITEMS.filter((item) => hasFeatureAccess(perfil, item.feature, features))
}

function isSidebarItemActive(pathname: string, href: string, exact = false) {
  if (href === "/") {
    return pathname === "/"
  }

  if (exact) {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}
