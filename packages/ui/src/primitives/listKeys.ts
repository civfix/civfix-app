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

/**
 * Pairs each run of a split text with its start offset in the source, the one identity a run has: the same
 * mention, link or word can repeat, so neither its text nor its target is unique.
 */
export function withTextOffsets<T extends { readonly text: string }>(
  runs: readonly T[],
): (T & { readonly offset: number })[] {
  const keyed: (T & { readonly offset: number })[] = []
  let offset = 0
  for (const run of runs) {
    keyed.push({ ...run, offset })
    offset += run.text.length
  }
  return keyed
}

/** Keys plain values by the value itself, counting repeats so a duplicate entry still gets its own key. */
export function withValueKeys(
  values: readonly string[],
): { readonly value: string; readonly key: string }[] {
  const seen = new Map<string, number>()
  return values.map((value) => {
    const occurrence = seen.get(value) ?? 0
    seen.set(value, occurrence + 1)
    return { value, key: `${occurrence}:${value}` }
  })
}
