import { type SessionPayload, verifySessionToken } from "@/lib/auth/session"
import { getUsuarioById } from "@/lib/repositories"

export async function resolveSessionFromToken(token: string | null | undefined): Promise<SessionPayload | null> {
  const session = await verifySessionToken(token)

  if (!session) {
    return null
  }

  const usuario = await getUsuarioById(session.userId)

  if (!usuario || !usuario.ativo) {
    return null
  }

  return {
    userId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    exp: session.exp,
  }
}
