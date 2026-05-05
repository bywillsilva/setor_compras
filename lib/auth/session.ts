import type { PerfilUsuario } from '@/lib/types'

export const SESSION_COOKIE_NAME = 'setor_compras_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export interface SessionPayload {
  userId: number
  nome: string
  email: string
  perfil: PerfilUsuario
  exp: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
let warnedMissingAuthSecret = false

export async function createSessionToken(
  payload: Omit<SessionPayload, 'exp'>,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
) {
  const session: SessionPayload = {
    ...payload,
    exp: Date.now() + maxAgeSeconds * 1000,
  }

  const serialized = encodeBase64Url(encoder.encode(JSON.stringify(session)))
  const signature = await signString(serialized)
  return `${serialized}.${signature}`
}

export async function verifySessionToken(token: string | null | undefined): Promise<SessionPayload | null> {
  if (!token) {
    return null
  }

  const [serialized, providedSignature] = token.split('.')

  if (!serialized || !providedSignature) {
    return null
  }

  const expectedSignature = await signString(serialized)

  if (providedSignature !== expectedSignature) {
    return null
  }

  try {
    const payload = JSON.parse(decoder.decode(decodeBase64Url(serialized))) as SessionPayload

    if (!payload.exp || payload.exp <= Date.now()) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

async function signString(value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getAuthSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return encodeBase64Url(new Uint8Array(signature))
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET?.trim()

  if (secret) {
    return secret
  }

  const derivedSecret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    [process.env.APP_ADMIN_EMAIL?.trim(), process.env.APP_ADMIN_PASSWORD?.trim()].filter(Boolean).join(":")

  if (derivedSecret) {
    warnMissingAuthSecret()
    return `setor-compras:${derivedSecret}`
  }

  if (process.env.NODE_ENV !== "production") {
    return "setor-compras-local-secret"
  }

  warnMissingAuthSecret()
  return "setor-compras-production-fallback-secret"
}

function warnMissingAuthSecret() {
  if (warnedMissingAuthSecret) {
    return
  }

  warnedMissingAuthSecret = true
  console.warn("AUTH_SECRET nao definido. Usando segredo derivado para manter a autenticacao operacional.")
}

function encodeBase64Url(bytes: Uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
  }

  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'))
  }

  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}
