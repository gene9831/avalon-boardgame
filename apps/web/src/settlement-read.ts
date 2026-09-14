/** Minimal browser-session storage contract, injectable for controller tests. */
export interface SettlementReadStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const PREFIX = 'avalon:settlement-read:'

export function settlementReadStorageKey(matchID: string, settlementKey: string): string {
  return `${PREFIX}${encodeURIComponent(matchID)}:${settlementKey}`
}

export function browserSettlementReadStorage(): SettlementReadStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function hasReadSettlement(
  storage: SettlementReadStorage | null | undefined,
  matchID: string,
  settlementKey: string,
): boolean {
  if (storage === null || storage === undefined) return false
  try {
    return storage.getItem(settlementReadStorageKey(matchID, settlementKey)) === '1'
  } catch {
    return false
  }
}

export function markSettlementRead(
  storage: SettlementReadStorage | null | undefined,
  matchID: string,
  settlementKey: string,
): void {
  if (storage === null || storage === undefined) return
  try {
    storage.setItem(settlementReadStorageKey(matchID, settlementKey), '1')
  } catch {
    // Receipts are presentation-only and must not prevent the current view.
  }
}
