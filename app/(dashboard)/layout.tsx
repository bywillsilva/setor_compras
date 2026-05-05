import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AuthProvider } from "@/components/auth-provider"
import { DashboardShell } from "@/components/dashboard-shell"
import { getCurrentSession } from "@/lib/auth/server"
import { SESSION_COOKIE_NAME } from "@/lib/auth/session"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const cookieStore = await cookies()
  const hasSessionCookie = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value)
  const session = await getCurrentSession()

  if (!session && hasSessionCookie) {
    redirect("/auth/login")
  }

  if (!session) {
    return (
      <AuthProvider session={null}>
        <div className="min-h-screen bg-background">{children}</div>
      </AuthProvider>
    )
  }

  return (
    <DashboardShell session={session}>{children}</DashboardShell>
  )
}
