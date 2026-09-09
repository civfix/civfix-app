export type ScanPresenter = (sessionId: string) => void

let presentSurface: ScanPresenter | null = null
let pendingScan: { id: string; resolve: (token: string | null) => void } | null = null
let scanSequence = 0
const subscribers = new Set<() => void>()

export function setScanPresenter(next: ScanPresenter | null): void {
  if (next === null) {
    const pending = pendingScan
    pendingScan = null
    pending?.resolve(null)
  }
  const changed = (presentSurface === null) !== (next === null)
  presentSurface = next
  if (changed) for (const notify of subscribers) notify()
}

export function scannerAvailable(): boolean {
  return presentSurface !== null
}

export function subscribeScannerAvailability(onChange: () => void): () => void {
  subscribers.add(onChange)
  return () => {
    subscribers.delete(onChange)
  }
}

export function presentScanner(): Promise<string | null> {
  const present = presentSurface
  if (!present) return Promise.resolve(null)
  pendingScan?.resolve(null)
  pendingScan = null
  scanSequence += 1
  const id = `scan-${scanSequence}`
  return new Promise<string | null>((resolve) => {
    pendingScan = { id, resolve }
    present(id)
  })
}

export function resolveScan(token: string | null, sessionId?: string): void {
  const pending = pendingScan
  if (!pending) return
  if (sessionId !== undefined && pending.id !== sessionId) return
  pendingScan = null
  pending.resolve(token)
}

export function resetScanPresenterForTests(): void {
  pendingScan?.resolve(null)
  pendingScan = null
  presentSurface = null
  scanSequence = 0
  subscribers.clear()
}
