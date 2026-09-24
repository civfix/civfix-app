export const DEFAULT_TOAST_DURATION_MS = 5000
export const MAX_TOASTS = 4

export function withinCap<T>(items: readonly T[], next: T, max: number = MAX_TOASTS): T[] {
  if (items.length + 1 <= max) return [...items, next]
  return [...items.slice(1), next]
}
