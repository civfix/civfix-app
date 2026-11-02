/**
 * Keys entries by a value of their own, counting repeats: two FAQ items with one question, or two hosts
 * with one name, still get keys of their own, and an edit elsewhere in the list leaves both keys alone.
 */
export function keyedByValue<T>(
  entries: readonly T[],
  valueOf: (entry: T) => string,
): { readonly entry: T; readonly key: string }[] {
  const seen = new Map<string, number>()
  return entries.map((entry) => {
    const value = valueOf(entry)
    const occurrence = seen.get(value) ?? 0
    seen.set(value, occurrence + 1)
    return { entry, key: `${occurrence}:${value}` }
  })
}
