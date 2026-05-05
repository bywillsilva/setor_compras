import { cookies } from "next/headers"
import { resolveSessionFromToken } from "@/lib/auth/resolved-session"
import { SESSION_COOKIE_NAME } from "@/lib/auth/session"

export async function getCurrentSession() {
  const cookieStore = await cookies()
  return resolveSessionFromToken(cookieStore.get(SESSION_COOKIE_NAME)?.value)
}
