import type { BroadcastSegment } from "@civfix/shared"

export type AudienceKind = BroadcastSegment["kind"]

export const AUDIENCE_KINDS: readonly AudienceKind[] = [
  "all_registered",
  "ticket_types",
  "slots",
  "waitlist",
  "checked_in",
  "not_checked_in",
  "guests_only",
]

export interface AudienceState {
  kind: AudienceKind
  ticketTypeIds: readonly string[]
  slotIds: readonly string[]
}

export const EMPTY_AUDIENCE: AudienceState = {
  kind: "all_registered",
  ticketTypeIds: [],
  slotIds: [],
}

export function segmentFrom(state: AudienceState): BroadcastSegment | null {
  switch (state.kind) {
    case "ticket_types":
      return state.ticketTypeIds.length > 0
        ? { kind: "ticket_types", ids: [...state.ticketTypeIds] }
        : null
    case "slots":
      return state.slotIds.length > 0 ? { kind: "slots", ids: [...state.slotIds] } : null
    default:
      return { kind: state.kind }
  }
}

export function audienceFrom(segment: BroadcastSegment | null | undefined): AudienceState {
  if (!segment) return EMPTY_AUDIENCE
  switch (segment.kind) {
    case "ticket_types":
      return { kind: "ticket_types", ticketTypeIds: segment.ids, slotIds: [] }
    case "slots":
      return { kind: "slots", ticketTypeIds: [], slotIds: segment.ids }
    default:
      return { kind: segment.kind, ticketTypeIds: [], slotIds: [] }
  }
}

export function audienceExcludesGuests(state: AudienceState): boolean {
  return state.kind === "slots"
}

export function audienceComplete(state: AudienceState): boolean {
  return segmentFrom(state) !== null
}

export const HOST_CHANNELS = ["inapp", "push", "email"] as const
export type HostChannel = (typeof HOST_CHANNELS)[number]

export function channelsComplete(channels: readonly string[]): boolean {
  return channels.length >= 1 && channels.length <= 3
}

export interface ComposerReadiness {
  subject: boolean
  body: boolean
  audience: boolean
  channels: boolean
}

export function composerReadiness(input: {
  subject: string
  bodyMd: string
  audience: AudienceState
  channels: readonly string[]
}): ComposerReadiness {
  return {
    subject: input.subject.trim().length > 0 && input.subject.trim().length <= 160,
    body: input.bodyMd.trim().length > 0 && input.bodyMd.trim().length <= 8000,
    audience: audienceComplete(input.audience),
    channels: channelsComplete(input.channels),
  }
}

export function composerReady(readiness: ComposerReadiness): boolean {
  return readiness.subject && readiness.body && readiness.audience && readiness.channels
}

export function broadcastCan(
  status: string,
): { edit: boolean; send: boolean; schedule: boolean; cancel: boolean; delete: boolean } {
  switch (status) {
    case "draft":
      return { edit: true, send: true, schedule: true, cancel: false, delete: true }
    case "scheduled":
      return { edit: false, send: true, schedule: true, cancel: true, delete: false }
    case "sending":
      return { edit: false, send: false, schedule: false, cancel: true, delete: false }
    default:
      return { edit: false, send: false, schedule: false, cancel: false, delete: false }
  }
}
