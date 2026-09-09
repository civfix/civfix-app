/**
 * Pure behavior models for ReportDetailBody, extracted so they are unit-testable without the RN body
 * (matching postComposerModel / profileViewModel / searchResultsModel).
 */

/**
 * The gallery's EFFECTIVE selected index. `selected` is user state that outlives the media list: a refetch
 * (a moderation event flipping an item ready -> rejected, the resolve mutation invalidating the report) can
 * shrink the ready list under a selection that pointed past its new end. Clamping AT USE keeps the hero, the
 * highlighted thumb and the lightbox's initial index on the SAME item; without it the hero fell back to the
 * first item while no thumb read as active and the lightbox opened out of range.
 */
export function clampGallerySelection(selected: number, readyCount: number): number {
  if (readyCount <= 0) return 0
  if (!Number.isFinite(selected) || selected < 0) return 0
  return Math.min(Math.trunc(selected), readyCount - 1)
}
