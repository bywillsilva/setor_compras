import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { getCurrentSession } from "@/lib/auth/server"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/auth/login")
  }

  return (
    <DashboardShell session={session}>{children}</DashboardShell>
  )
}
