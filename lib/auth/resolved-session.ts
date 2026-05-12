import { type SessionPayload, verifySessionToken } from "@/lib/auth/session"
import { getDefaultFeaturesForPerfil } from "@/lib/auth/permissions"
import { getUsuarioById, listFeaturesByUsuario } from "@/lib/repositories"

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
    features = await listFeaturesByUsuario(usuario.id, usuario.perfil)
  } catch (permissionError) {
    console.warn(
      "Falha ao carregar permissoes do usuario na resolucao da sessao. Aplicando permissoes padrao temporariamente.",
      permissionError,
    )
  }

  return {
    userId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    tema: usuario.tema_preferido,
    features,
    exp: session.exp,
  }
}
