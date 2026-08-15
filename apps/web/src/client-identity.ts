import type { RoomSessionStorage } from './room-session'

export const CLIENT_ID_KEY = 'avalon:client-id'

export interface ClientCrypto {
  randomUUID?: () => string
  getRandomValues: (array: Uint8Array) => Uint8Array
}

function browserStorage(): RoomSessionStorage {
  if (typeof window === 'undefined') {
    throw new Error('Client identity storage is only available in a browser')
  }

  return window.localStorage
}

export function getClientID(
  storage: RoomSessionStorage = browserStorage(),
  createID: () => string = () => createClientID(),
) {
  const storedID = storage.getItem(CLIENT_ID_KEY)
  if (storedID !== null && storedID.length > 0) return storedID

  const clientID = createID()
  if (clientID.length === 0) {
    throw new Error('Client identity generator returned an empty ID')
  }

  storage.setItem(CLIENT_ID_KEY, clientID)
  return clientID
}

export function createClientID(
  cryptoAPI: ClientCrypto = globalThis.crypto as ClientCrypto,
) {
  if (typeof cryptoAPI.randomUUID === 'function') {
    return cryptoAPI.randomUUID()
  }

  const bytes = cryptoAPI.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}
