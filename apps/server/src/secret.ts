import { createHash, timingSafeEqual } from 'node:crypto'

const MAX_SECRET_LENGTH = 512

function isBoundedSecret(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_SECRET_LENGTH
}

function digestSecret(value: string) {
  return createHash('sha256').update(value, 'utf8').digest()
}

export function secretMatches(provided: unknown, stored: unknown) {
  if (!isBoundedSecret(provided) || !isBoundedSecret(stored)) return false
  return timingSafeEqual(digestSecret(provided), digestSecret(stored))
}
