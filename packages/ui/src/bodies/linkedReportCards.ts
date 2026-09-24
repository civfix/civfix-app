import { create } from "zustand"
import type {
  LinkedReportRef,
  ReportCategory,
  ReportDTO,
  ReportPinDTO,
  ReportStatus,
  ReportType,
} from "@civfix/shared"
import { firstReportPhoto } from "./reportsListModel"

export interface LinkedReportCardData {
  id: string
  category: ReportCategory
  type?: ReportType | null
  title?: string | null
  description?: string | null
  status: ReportStatus | null
  thumbUrl?: string | null
  addr?: string | null
  referenceCode?: string | null
}

export interface LinkedReportCardEntry extends LinkedReportCardData {
  lat: number
  lng: number
}

export function pinToCardData(pin: ReportPinDTO): LinkedReportCardEntry {
  return {
    id: pin.id,
    category: pin.category,
    status: pin.status,
    lat: pin.lat,
    lng: pin.lng,
    ...(pin.type !== undefined ? { type: pin.type } : {}),
    ...(pin.title !== undefined ? { title: pin.title } : {}),
    ...(pin.description !== undefined ? { description: pin.description } : {}),
    ...(pin.thumbUrl !== undefined ? { thumbUrl: pin.thumbUrl } : {}),
    ...(pin.addr !== undefined ? { addr: pin.addr } : {}),
    ...(pin.referenceCode !== undefined ? { referenceCode: pin.referenceCode } : {}),
  }
}

export function linkedRefToCardData(ref: LinkedReportRef): LinkedReportCardEntry {
  return {
    id: ref.id,
    category: ref.category,
    status: ref.status,
    title: ref.title,
    lat: ref.lat,
    lng: ref.lng,
    ...(ref.type !== undefined ? { type: ref.type } : {}),
    ...(ref.addr !== undefined ? { addr: ref.addr } : {}),
    ...(ref.thumbUrl !== undefined ? { thumbUrl: ref.thumbUrl } : {}),
  }
}

export function reportThumbUrl(report: ReportDTO): string | null {
  const photo = firstReportPhoto(report)
  return photo ? (photo.thumbUrl ?? photo.url) : null
}

export function reportToCardData(report: ReportDTO): LinkedReportCardEntry {
  return {
    id: report.id,
    category: report.category,
    type: report.type,
    title: report.title,
    description: report.description,
    status: report.status,
    thumbUrl: reportThumbUrl(report),
    addr: report.addr,
    referenceCode: report.referenceCode,
    lat: report.lat,
    lng: report.lng,
  }
}

export function sameCardEntry(
  a: LinkedReportCardEntry | undefined,
  b: LinkedReportCardEntry,
): boolean {
  if (a === undefined) return false
  return (
    a.id === b.id &&
    a.category === b.category &&
    (a.type ?? null) === (b.type ?? null) &&
    (a.title ?? null) === (b.title ?? null) &&
    (a.description ?? null) === (b.description ?? null) &&
    a.status === b.status &&
    (a.thumbUrl ?? null) === (b.thumbUrl ?? null) &&
    (a.addr ?? null) === (b.addr ?? null) &&
    (a.referenceCode ?? null) === (b.referenceCode ?? null) &&
    a.lat === b.lat &&
    a.lng === b.lng
  )
}

export function mergeCardEntry(
  prev: LinkedReportCardEntry | undefined,
  incoming: LinkedReportCardEntry,
): LinkedReportCardEntry {
  if (!prev) return incoming
  const keepReference = incoming.referenceCode == null && prev.referenceCode != null
  return keepReference ? { ...incoming, referenceCode: prev.referenceCode } : incoming
}

export interface LinkedReportCardsState {
  cards: Record<string, LinkedReportCardEntry>
  put: (cards: readonly LinkedReportCardEntry[]) => void
  clear: () => void
}

export const useLinkedReportCards = create<LinkedReportCardsState>((set) => ({
  cards: {},

  put: (incoming) =>
    set((state) => {
      const next = { ...state.cards }
      let changed = false
      for (const card of incoming) {
        const merged = mergeCardEntry(next[card.id], card)
        if (sameCardEntry(next[card.id], merged)) continue
        next[card.id] = merged
        changed = true
      }
      return changed ? { cards: next } : state
    }),

  clear: () => set((state) => (Object.keys(state.cards).length === 0 ? state : { cards: {} })),
}))
