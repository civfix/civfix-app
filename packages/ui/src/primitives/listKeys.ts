export const idKeyExtractor = (item: { id: string }) => item.id

/** Keeps the first occurrence of each id in order, and hands back the same array when nothing repeats. */
export function dedupeById<T extends { id: string }>(items: readonly T[]): readonly T[] {
  const seen = new Set<string>()
  const unique: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    unique.push(item)
  }
  return unique.length === items.length ? items : unique
}
