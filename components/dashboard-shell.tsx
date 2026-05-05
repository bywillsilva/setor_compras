"use client"

import { useEffect, useState, type ReactNode } from "react"
import type { SessionPayload } from "@/lib/auth/session"
import { cn } from "@/lib/utils"
import { AuthProvider } from "@/components/auth-provider"
import { AppSidebar } from "@/components/app-sidebar"

const SIDEBAR_STORAGE_KEY = "setor-compras-sidebar-collapsed"

export function DashboardShell({
  session,
  children,
}: {
  session: SessionPayload
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const savedState = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    setCollapsed(savedState === "true")
  }, [])

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
  }, [collapsed])

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
          {children}
        </main>
      </div>
    </AuthProvider>
  )
}
