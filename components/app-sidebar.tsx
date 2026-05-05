"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { PERFIL_LABELS } from "@/lib/auth/permissions"
import { cn } from "@/lib/utils"

type NavigationItem = {
  name: string
  href: string
  icon: typeof LayoutDashboard
}

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

  const navigation = getNavigation(session.perfil)

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
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))

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
          {session.perfil === "admin" && (
            <Link
              href="/configuracoes"
              title={collapsed ? "Configuracoes" : undefined}
              className={cn(
                "flex rounded-lg text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                collapsed ? "justify-center px-2 py-3" : "items-center gap-3 px-3 py-2",
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

function getNavigation(perfil: "admin" | "comprador" | "orcamentista"): NavigationItem[] {
  if (perfil === "orcamentista") {
    return [{ name: "Orcamentos", href: "/orcamentos", icon: Calculator }]
  }

  const baseNavigation: NavigationItem[] = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Clientes", href: "/clientes", icon: Users },
    { name: "Propostas", href: "/propostas", icon: FileText },
    { name: "Compras", href: "/compras", icon: ShoppingCart },
  ]

  if (perfil === "admin" || perfil === "comprador") {
    if (perfil === "admin") {
      baseNavigation.push({ name: "Solicitacoes", href: "/solicitacoes-autorizacao", icon: CheckCircle2 })
    }

    if (perfil === "comprador") {
      baseNavigation.push({ name: "Autorizacoes", href: "/autorizacoes", icon: CheckCircle2 })
    }
  }

  baseNavigation.push({ name: "Entregas", href: "/entregas", icon: Truck })

  if (perfil === "admin") {
    baseNavigation.push({ name: "Orcamentos", href: "/orcamentos", icon: Calculator })
  }

  return baseNavigation
}
