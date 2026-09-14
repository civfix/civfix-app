import { create } from "zustand"
import type { LinkedReportRef, ReportDTO, ReportPinDTO } from "@civfix/shared"
import type { LinkedReportCardData } from "./LinkedReportCard"

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
  const photo = report.media.find((m) => m.kind === "image" && m.status === "ready")
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
        if (sameCardEntry(next[card.id], card)) continue
        next[card.id] = card
        changed = true
      }
      return changed ? { cards: next } : state
    }),

  clear: () => set((state) => (Object.keys(state.cards).length === 0 ? state : { cards: {} })),
}))
