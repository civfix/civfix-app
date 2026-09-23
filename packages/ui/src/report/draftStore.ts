import { create } from "zustand"
import type { CapturedMedia } from "../capabilities"

export interface DraftMedia {
  id: string
  uri: string
  kind: "image" | "video"
  mime: string
  width?: number
  height?: number
  durationSec?: number
  uploadId?: string
}

export type GeomSource = "device" | "exif" | "manual"

export interface DraftFlags {
  blockingSidewalk: boolean
  safetyHazard: boolean
}

export type DraftCategory = "trash" | "recycling" | "graffiti" | "hazard" | "encampment" | "water" | "other"

export interface DraftReport {
  idempotencyKey: string | null
  category: DraftCategory | null
  reportTypeId: string | null
  title: string
  titleEdited: boolean
  description: string
  flags: DraftFlags
  lat: number | null
  lng: number | null
  geomSource: GeomSource
  locationPrefilled: boolean
  locationMediaId: string | null
  capturedAt: string | null
  addr: string | null
  addrEdited: boolean
  media: DraftMedia[]
  shareToFeed: boolean
  feedCaption: string
  feedPostId: string | null
}

interface DraftReportState {
  draft: DraftReport
  freshSeeds: number
  ensureIdempotencyKey: () => string
  setCategory: (category: DraftCategory, defaultTitle: string, reportTypeId?: string) => void
  setTitle: (title: string) => void
  setDescription: (description: string) => void
  setFlag: (flag: keyof DraftFlags, value: boolean) => void
  setLocation: (lat: number, lng: number, source: GeomSource, capturedAt?: string) => void
  setPrefilledLocation: (lat: number, lng: number) => void
  clearLocation: () => void
  setAddress: (addr: string) => void
  setPrefilledAddress: (addr: string) => void
  setMedia: (media: DraftMediaInput) => void
  startFromCapture: (media: CapturedMedia) => void
  addCapture: (media: CapturedMedia) => void
  addMedia: (media: DraftMediaInput) => void
  removeMedia: (idOrUri: string) => void
  setMediaUploadId: (id: string, uploadId: string) => void
  clearMediaUploadIds: () => void
  setShareToFeed: (value: boolean) => void
  setFeedCaption: (caption: string) => void
  setFeedPostId: (postId: string | null) => void
  reset: () => void
}

export const MAX_DRAFT_MEDIA = 5

const EMPTY_FLAGS: DraftFlags = {
  blockingSidewalk: false,
  safetyHazard: false,
}

const EMPTY: DraftReport = {
  idempotencyKey: null,
  category: null,
  reportTypeId: null,
  title: "",
  titleEdited: false,
  description: "",
  flags: EMPTY_FLAGS,
  lat: null,
  lng: null,
  geomSource: "device",
  locationPrefilled: false,
  locationMediaId: null,
  capturedAt: null,
  addr: null,
  addrEdited: false,
  media: [],
  shareToFeed: false,
  feedCaption: "",
  feedPostId: null,
}

function randomUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c && typeof c.randomUUID === "function") return c.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export type DraftMediaInput = Omit<DraftMedia, "id">

function draftMediaFromCapture(media: CapturedMedia): DraftMedia {
  return {
    id: randomUuid(),
    uri: media.uri,
    kind: media.kind,
    mime: media.mime,
    ...(media.width != null ? { width: media.width } : {}),
    ...(media.height != null ? { height: media.height } : {}),
    ...(media.durationSec != null ? { durationSec: media.durationSec } : {}),
  }
}

// A capture into a media-less draft only starts a NEW report when nothing else was authored: removing every
// capture must not throw away the category, title and description the reporter already wrote.
export function captureSeedsNewReport(
  draft: Pick<
    DraftReport,
    "media" | "category" | "reportTypeId" | "title" | "description" | "flags" | "lat" | "locationPrefilled" | "addrEdited"
  >,
): boolean {
  if (draft.media.length > 0) return false
  const manualPoint = draft.lat != null && !draft.locationPrefilled
  return (
    draft.category === null &&
    draft.reportTypeId === null &&
    draft.title.trim() === "" &&
    draft.description.trim() === "" &&
    !draft.flags.blockingSidewalk &&
    !draft.flags.safetyHazard &&
    !manualPoint &&
    (!draft.addrEdited || draft.locationPrefilled)
  )
}

export const useDraftReportStore = create<DraftReportState>((set, get) => ({
  draft: EMPTY,
  freshSeeds: 0,

  ensureIdempotencyKey: () => {
    const existing = get().draft.idempotencyKey
    if (existing) return existing
    const key = randomUuid()
    set((s) => ({ draft: { ...s.draft, idempotencyKey: key } }))
    return key
  },

  setCategory: (category, defaultTitle, reportTypeId) =>
    set((s) => ({
      draft: {
        ...s.draft,
        category,
        reportTypeId: reportTypeId ?? s.draft.reportTypeId,
        title: s.draft.titleEdited ? s.draft.title : defaultTitle,
      },
    })),
  setTitle: (title) => set((s) => ({ draft: { ...s.draft, title, titleEdited: true } })),
  setDescription: (description) => set((s) => ({ draft: { ...s.draft, description } })),
  setFlag: (flag, value) =>
    set((s) => ({ draft: { ...s.draft, flags: { ...s.draft.flags, [flag]: value } } })),
  setLocation: (lat, lng, geomSource, capturedAt) =>
    set((s) => ({
      draft: {
        ...s.draft,
        lat,
        lng,
        geomSource,
        locationMediaId: null,
        capturedAt: capturedAt ?? s.draft.capturedAt,
      },
    })),
  setPrefilledLocation: (lat, lng) =>
    set((s) => ({
      draft: { ...s.draft, lat, lng, geomSource: "manual", locationPrefilled: true, locationMediaId: null },
      freshSeeds: s.freshSeeds + 1,
    })),
  clearLocation: () =>
    set((s) => ({
      draft: { ...s.draft, lat: null, lng: null, locationPrefilled: false, locationMediaId: null },
    })),
  setAddress: (addr) => set((s) => ({ draft: { ...s.draft, addr, addrEdited: true } })),
  setPrefilledAddress: (addr) =>
    set((s) => (s.draft.addrEdited ? s : { draft: { ...s.draft, addr } })),
  setMedia: (media) => set((s) => ({ draft: { ...s.draft, media: [{ id: randomUuid(), ...media }] } })),

  startFromCapture: (media) => {
    const capturedAt = new Date().toISOString()
    const seeded = draftMediaFromCapture(media)
    set((s) => {
      const prefilled =
        s.draft.locationPrefilled && s.draft.lat != null && s.draft.lng != null
          ? {
              lat: s.draft.lat,
              lng: s.draft.lng,
              geomSource: s.draft.geomSource,
              addr: s.draft.addr,
              addrEdited: s.draft.addrEdited,
              locationPrefilled: true,
            }
          : null
      return {
        draft: {
          ...EMPTY,
          flags: { ...EMPTY_FLAGS },
          idempotencyKey: randomUuid(),
          media: [seeded],
          capturedAt,
          ...(media.location
            ? {
                lat: media.location.lat,
                lng: media.location.lng,
                geomSource: media.location.source,
                locationMediaId: seeded.id,
              }
            : {}),
          ...(prefilled ? { ...prefilled, locationMediaId: null } : {}),
        },
      }
    })
  },

  addCapture: (media) =>
    set((s) => {
      const added = draftMediaFromCapture(media)
      const becomesLocationSource = s.draft.media.length === 0 && s.draft.lat == null && media.location != null
      return {
        draft: {
          ...s.draft,
          media: [...s.draft.media, added].slice(0, MAX_DRAFT_MEDIA),
          ...(becomesLocationSource && media.location
            ? {
                lat: media.location.lat,
                lng: media.location.lng,
                geomSource: media.location.source,
                locationMediaId: added.id,
              }
            : {}),
        },
      }
    }),
  addMedia: (media) =>
    set((s) => ({
      draft: {
        ...s.draft,
        media: [...s.draft.media, { id: randomUuid(), ...media }].slice(0, MAX_DRAFT_MEDIA),
      },
    })),
  removeMedia: (idOrUri) =>
    set((s) => {
      const i = s.draft.media.findIndex((m) => m.id === idOrUri)
      const at = i >= 0 ? i : s.draft.media.findIndex((m) => m.uri === idOrUri)
      if (at < 0) return s
      const removed = s.draft.media[at]
      const media = s.draft.media.filter((_, j) => j !== at)
      if (removed === undefined || removed.id !== s.draft.locationMediaId) return { draft: { ...s.draft, media } }
      return { draft: { ...s.draft, media, lat: null, lng: null, locationMediaId: null } }
    }),
  setMediaUploadId: (id, uploadId) =>
    set((s) => ({
      draft: {
        ...s.draft,
        media: s.draft.media.map((m) => (m.id === id ? { ...m, uploadId } : m)),
      },
    })),
  clearMediaUploadIds: () =>
    set((s) => ({
      draft: { ...s.draft, media: s.draft.media.map(({ uploadId: _dropped, ...m }) => m) },
    })),
  setShareToFeed: (shareToFeed) => set((s) => ({ draft: { ...s.draft, shareToFeed } })),
  setFeedCaption: (feedCaption) => set((s) => ({ draft: { ...s.draft, feedCaption } })),
  setFeedPostId: (feedPostId) => set((s) => ({ draft: { ...s.draft, feedPostId } })),
  reset: () =>
    set((s) => ({
      draft: { ...EMPTY, flags: { ...EMPTY_FLAGS }, media: [] },
      freshSeeds: s.freshSeeds + 1,
    })),
}))
