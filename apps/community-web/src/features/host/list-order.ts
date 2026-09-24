/** A copy of `list` with the item at `index` moved by `delta`; an out-of-range target leaves the order as is. */
export function moveItem<T>(list: readonly T[], index: number, delta: number): T[] {
  const next = [...list]
  const target = index + delta
  if (target < 0 || target >= next.length) return next
  const [moved] = next.splice(index, 1)
  if (moved !== undefined) next.splice(target, 0, moved)
  return next
}
