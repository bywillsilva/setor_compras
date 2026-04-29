import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(':')

  if (!salt || !expectedHash) {
    return false
  }

  try {
    const calculatedHash = scryptSync(password, salt, 64).toString('hex')
    return timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(calculatedHash, 'hex'))
  } catch {
    return false
  }
}
