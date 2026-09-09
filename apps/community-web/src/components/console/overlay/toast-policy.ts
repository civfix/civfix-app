export const DEFAULT_TOAST_DURATION_MS = 5000
export const UNDO_TOAST_DURATION_MS = 10000
export const MAX_TOASTS = 4

export function resolveUndoDuration(requested?: number): number {
  if (requested === undefined) return UNDO_TOAST_DURATION_MS
  return Math.max(requested, UNDO_TOAST_DURATION_MS)
}

export function withinCap<T extends { action?: unknown }>(
  items: readonly T[],
  next: T,
  max: number = MAX_TOASTS,
): T[] {
  if (items.length + 1 <= max) return [...items, next]
  const evictable = items.findIndex((item) => !item.action)
  if (evictable === -1) return [...items, next]
  const kept = items.slice()
  kept.splice(evictable, 1)
  return [...kept, next]
}
