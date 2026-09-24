import type { CleanupDTO, LinkedEventRef, ReportDTO } from "@civfix/shared"

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

export function linkedEventToCleanup(event: LinkedEventRef): CleanupDTO {
  return {
    id: event.id,
    title: event.title,
    type: "site",
    eventKind: event.eventKind,
    lat: event.lat,
    lng: event.lng,
    scheduledAt: event.scheduledAt,
    endsAt: event.endsAt ?? null,
    timezone: event.timezone ?? null,
    status: event.status,
    organizer: event.organizer,
    going: event.going,
    joined: false,
    bring: [],
    address: null,
    description: null,
    linkedReports: [],
    slots: [],
    visibility: "public",
    galleryUrls: [],
    ticketTypes: [],
    myCapabilities: [],
  }
}
