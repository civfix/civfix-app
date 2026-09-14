export const EMBED_LOAD_CONCURRENCY = 6

export const EMBED_VIEWPORT_LOOKAHEAD = 2

type Listener = () => void

interface KeyedListeners {
  add(key: string, listener: Listener): () => void
  notify(key: string): void
  keys(): string[]
}

function keyedListeners(): KeyedListeners {
  const byKey = new Map<string, Set<Listener>>()
  return {
    add(key, listener) {
      const set = byKey.get(key) ?? new Set<Listener>()
      set.add(listener)
      byKey.set(key, set)
      return () => {
        set.delete(listener)
        if (set.size === 0) byKey.delete(key)
      }
    },
    notify(key) {
      const set = byKey.get(key)
      if (set === undefined) return
      for (const listener of [...set]) listener()
    },
    keys: () => [...byKey.keys()],
  }
}

export interface EmbedLoadQueue {
  subscribe(key: string, listener: Listener): () => void
  isAdmitted(key: string): boolean
  request(key: string): void
  drop(key: string): void
  settle(key: string, cached: boolean): void
  activeCount(): number
  waitingCount(): number
}

export function createEmbedLoadQueue(limit: number = EMBED_LOAD_CONCURRENCY): EmbedLoadQueue {
  const listeners = keyedListeners()
  const wanted = new Map<string, number>()
  const waiting: string[] = []
  const active = new Set<string>()
  const holding = new Set<string>()
  const cached = new Set<string>()

  const isAdmitted = (key: string): boolean => cached.has(key) || active.has(key) || holding.has(key)

  const unqueue = (key: string): void => {
    const at = waiting.indexOf(key)
    if (at >= 0) waiting.splice(at, 1)
  }

  const pump = (): void => {
    while (active.size < limit && waiting.length > 0) {
      const key = waiting.shift() as string
      if (!wanted.has(key) || isAdmitted(key)) continue
      active.add(key)
      listeners.notify(key)
    }
  }

  return {
    subscribe: (key, listener) => listeners.add(key, listener),
    isAdmitted,
    request(key) {
      const held = wanted.get(key) ?? 0
      wanted.set(key, held + 1)
      if (held > 0 || isAdmitted(key)) return
      waiting.push(key)
      pump()
    },
    drop(key) {
      const held = wanted.get(key)
      if (held === undefined) return
      if (held > 1) {
        wanted.set(key, held - 1)
        return
      }
      wanted.delete(key)
      unqueue(key)
      holding.delete(key)
      if (!active.delete(key)) return
      listeners.notify(key)
      pump()
    },
    settle(key, wasCached) {
      unqueue(key)
      if (wasCached) cached.add(key)
      else if (wanted.has(key)) holding.add(key)
      if (!active.delete(key)) return
      pump()
    },
    activeCount: () => active.size,
    waitingCount: () => waiting.length,
  }
}

export interface EmbedViewport {
  subscribe(key: string, listener: Listener): () => void
  isVisible(key: string): boolean
  setVisible(keys: readonly string[]): void
}

export function createEmbedViewport(): EmbedViewport {
  const listeners = keyedListeners()
  let reported = false
  let visible: ReadonlySet<string> = new Set<string>()
  return {
    subscribe: (key, listener) => listeners.add(key, listener),
    isVisible: (key) => !reported || visible.has(key),
    setVisible(keys) {
      const next = new Set(keys)
      const changed: string[] = []
      if (reported) {
        for (const key of next) if (!visible.has(key)) changed.push(key)
        for (const key of visible) if (!next.has(key)) changed.push(key)
      } else {
        reported = true
        for (const key of listeners.keys()) if (!next.has(key)) changed.push(key)
      }
      visible = next
      for (const key of changed) listeners.notify(key)
    },
  }
}

const NEVER_CHANGES = (): void => {}

export function createOpenViewport(): EmbedViewport {
  return {
    subscribe: () => NEVER_CHANGES,
    isVisible: () => true,
    setVisible: NEVER_CHANGES,
  }
}

export function viewportWindowKeys(
  rows: readonly { id: string }[],
  viewable: readonly { index: number | null }[],
  lookahead: number = EMBED_VIEWPORT_LOOKAHEAD,
): string[] {
  let first = Number.POSITIVE_INFINITY
  let last = Number.NEGATIVE_INFINITY
  for (const item of viewable) {
    const index = item.index
    if (index === null || !Number.isInteger(index)) continue
    if (index < first) first = index
    if (index > last) last = index
  }
  if (last < first) return []
  const from = Math.max(0, first - lookahead)
  const to = Math.min(rows.length - 1, last + lookahead)
  const keys: string[] = []
  for (let i = from; i <= to; i += 1) {
    const row = rows[i]
    if (row !== undefined) keys.push(row.id)
  }
  return keys
}
