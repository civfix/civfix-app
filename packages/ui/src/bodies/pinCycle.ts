/**
 * The PinnedBar's tap advance: pins are ordered pinned_at DESC, so the next OLDER pin is index + 1,
 * wrapping back to the newest (0) after the oldest.
 */
export function nextPinIndex(current: number, count: number): number {
  if (count <= 1) return 0
  const next = current + 1
  return next >= count ? 0 : next
}
