"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { SessionPayload } from "@/lib/auth/session"

const AuthContext = createContext<SessionPayload | null>(null)

export function AuthProvider({
  session,
  children,
}: {
  session: SessionPayload | null
  children: ReactNode
}) {
  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>
}

export function useCurrentSession() {
  return useContext(AuthContext)
}
