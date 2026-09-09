/**
 * nextPinIndex (P3 Task 3.6) - the PURE cyclic advance behind the PinnedBar's tap behavior:
 * tapping the bar jumps to the pin at the CURRENT index, then advances to the next OLDER pin
 * (pins are ordered pinned_at DESC, so "next" = index + 1), wrapping back to the newest (0)
 * after the oldest. Degenerate counts stay parked at 0.
 */
export function nextPinIndex(current: number, count: number): number {
  if (count <= 1) return 0
  const next = current + 1
  return next >= count ? 0 : next
}
