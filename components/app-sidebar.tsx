"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react"
import { useCurrentSession } from "@/components/auth-provider"
import { NotificationCenter } from "@/components/notification-center"
import { ThemeModeToggle } from "@/components/theme-mode-toggle"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { hasFeatureAccess } from "@/lib/auth/permissions"
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
  { name: "Autorizacoes", href: "/autorizacoes", icon: CheckCircle2, feature: "autorizacoes" },
  { name: "Aprovacao ADM", href: "/solicitacoes-autorizacao", icon: ShieldCheck, feature: "solicitacoes_autorizacao" },
  { name: "Financeiro", href: "/financeiro", icon: Landmark, feature: "financeiro" },
  { name: "Entregas", href: "/entregas", icon: Truck, feature: "entregas" },
  { name: "Orcamentos", href: "/orcamentos", icon: Calculator, feature: "orcamentos" },
  { name: "Resumo de Contratos", href: "/resumo-contratos", icon: FolderKanban, feature: "resumo_contratos" },
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
  const [mobileOpen, setMobileOpen] = useState(false)

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
    <>
      <div className="fixed inset-x-0 top-0 z-50 border-b border-sidebar-border bg-sidebar/95 backdrop-blur md:hidden">
        <div className="flex h-16 items-center gap-3 px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent/60"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/ag-compras-logo.png"
              alt="AG Compras"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-2xl border border-white/10 bg-white/95 object-cover shadow-sm"
              priority
            />
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">AG Compras</h1>
              <p className="truncate text-[11px] text-sidebar-foreground/70">Sistema Corporativo</p>
            </div>
          </Link>

          <div className="ml-auto">
            <NotificationCenter />
          </div>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[88vw] max-w-sm border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <div className="sr-only">
            <SheetTitle>Navegacao principal</SheetTitle>
            <SheetDescription>Menu do sistema AG Compras.</SheetDescription>
          </div>
          <SidebarContent
            collapsed={false}
            pathname={pathname}
            navigation={navigation}
            session={session}
            loggingOut={loggingOut}
            onLogout={handleLogout}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out md:block",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          pathname={pathname}
          navigation={navigation}
          session={session}
          loggingOut={loggingOut}
          onLogout={handleLogout}
          onToggleCollapsed={onToggleCollapsed}
        />
      </aside>
    </>
  )
}

function SidebarContent({
  collapsed,
  pathname,
  navigation,
  session,
  loggingOut,
  onLogout,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed: boolean
  pathname: string
  navigation: NavigationItem[]
  session: NonNullable<ReturnType<typeof useCurrentSession>>
  loggingOut: boolean
  onLogout: () => void
  onToggleCollapsed?: () => void
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 items-center border-b border-sidebar-border", collapsed ? "justify-center px-3" : "gap-3 px-4")}>
        <div className="flex items-center gap-3 overflow-hidden">
          <Image
            src="/ag-compras-logo.png"
            alt="AG Compras"
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-white/95 object-cover shadow-sm"
            priority
          />
          {!collapsed && (
            <div>
              <h1 className="text-lg font-semibold">AG Compras</h1>
              <p className="text-xs text-sidebar-foreground/70">Sistema Corporativo</p>
            </div>
          )}
        </div>

        {onToggleCollapsed ? (
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
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive = isSidebarItemActive(pathname, item.href, item.exact)

          return (
            <Link
              key={item.name}
              href={item.href}
              title={collapsed ? item.name : undefined}
              onClick={onNavigate}
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
                onClick={onNavigate}
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
            onClick={onNavigate}
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
          onClick={onLogout}
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

        <div className={cn("mt-3", collapsed ? "flex justify-center" : "space-y-2")}>
          <ThemeModeToggle collapsed={collapsed} />
        </div>
      </div>
    </div>
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
