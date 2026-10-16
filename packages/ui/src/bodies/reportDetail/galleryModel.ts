import type { ReportDTO } from "@civfix/contract"

type ReportMedia = ReportDTO["media"][number]

export interface GalleryTiles {
  ready: ReportMedia[]
  ownerPending: ReportMedia[]
  ownerFailed: ReportMedia[]
  tileCount: number
}

export function partitionGalleryMedia(media: readonly ReportMedia[], pending: number): GalleryTiles {
  const ready = media.filter((m) => m.status === "ready")
  const ownerPending = media.filter((m) => m.status === "validating")
  const ownerFailed = media.filter((m) => m.status === "rejected" || m.status === "held")
  return {
    ready,
    ownerPending,
    ownerFailed,
    tileCount: ready.length + ownerPending.length + ownerFailed.length + pending,
  }
}

/**
 * `selected` outlives the media list: a refetch (an item moderated to rejected, the report invalidated) can
 * shrink the ready list under a selection past its new end. Clamping at use keeps the hero, the highlighted
 * thumb and the lightbox's initial index on the same item.
 */
export function clampGallerySelection(selected: number, readyCount: number): number {
  if (readyCount <= 0) return 0
  if (!Number.isFinite(selected) || selected < 0) return 0
  return Math.min(Math.trunc(selected), readyCount - 1)
}

/**
 * Where the reporter's refused items go. The server only counts them for the reporter (and never counts held
 * media), so this is 0 for everyone else and the gallery renders as before. The refused tile takes the hero only
 * when nothing ready or processing can. Each refused item gets one strip tile whenever the strip shows.
 */
export function refusedGalleryTiles(counts: { ready: number; processing: number; refused: number }): {
  hero: boolean
  strip: number
} {
  if (counts.refused === 0) return { hero: false, strip: 0 }
  // Like the ready case, the strip lists the hero's item too and shows only when there is more than one tile.
  if (counts.ready === 0 && counts.processing === 0) return { hero: true, strip: counts.refused > 1 ? counts.refused : 0 }
  return { hero: false, strip: counts.refused }
}
