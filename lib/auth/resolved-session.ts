import { type SessionPayload, verifySessionToken } from "@/lib/auth/session"
import { getDefaultFeaturesForPerfil } from "@/lib/auth/permissions"
import { getUsuarioById, listFeaturesByPerfil } from "@/lib/repositories"

export async function resolveSessionFromToken(token: string | null | undefined): Promise<SessionPayload | null> {
  const session = await verifySessionToken(token)

  if (!session) {
    return null
  }

  const usuario = await getUsuarioById(session.userId)

  if (!usuario || !usuario.ativo) {
    return null
  }

  let features = getDefaultFeaturesForPerfil(usuario.perfil)
  try {
    features = await listFeaturesByPerfil(usuario.perfil)
  } catch (permissionError) {
    console.warn(
      "Falha ao carregar permissoes por perfil na resolucao da sessao. Aplicando permissoes padrao temporariamente.",
      permissionError,
    )
  }

  return {
    userId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    features,
    exp: session.exp,
  }
}
