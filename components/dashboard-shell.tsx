"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getDefaultPathForPerfil, getFeatureForPath, hasFeatureAccess } from "@/lib/auth/permissions"
import type { SessionPayload } from "@/lib/auth/session"
import { cn } from "@/lib/utils"
import { AuthProvider } from "@/components/auth-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { NotificationCenter } from "@/components/notification-center"

const SIDEBAR_STORAGE_KEY = "setor-compras-sidebar-collapsed"

export function DashboardShell({
  session,
  children,
}: {
  session: SessionPayload
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const isCurrentPathAllowed = useMemo(() => {
    const feature = getFeatureForPath(pathname)
    if (!feature) {
      return true
    }

    return hasFeatureAccess(session.perfil, feature, session.features)
  }, [pathname, session.features, session.perfil])

  useEffect(() => {
    const savedState = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    setCollapsed(savedState === "true")
  }, [])

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
  }, [collapsed])

  useEffect(() => {
    if (isCurrentPathAllowed) {
      return
    }

    router.replace(getDefaultPathForPerfil(session.perfil, session.features))
  }, [isCurrentPathAllowed, router, session.features, session.perfil])

  return (
    <AuthProvider session={session}>
      <div className="min-h-screen bg-background">
        <AppSidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((current) => !current)} />
        <main
          className={cn(
            "min-h-screen transition-[margin] duration-200 ease-out",
            collapsed ? "md:ml-20" : "md:ml-64",
          )}
        >
          {isCurrentPathAllowed ? (
            <div className="mx-auto w-full max-w-[1680px]">
              <div className="flex justify-end px-4 pb-1 pt-4 md:px-6">
                <NotificationCenter />
              </div>
              {children}
            </div>
          ) : null}
        </main>
      </div>
    </AuthProvider>
  )
}
