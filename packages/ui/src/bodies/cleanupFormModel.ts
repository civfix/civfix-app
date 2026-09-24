/**
 * The host-event form's value and the pure rules around it, kept out of the RN component file so the draft
 * store, the exit model and their tests read them without loading react-native.
 */
import type { EventAddressSource, EventKind, EventSlotDTO } from "@civfix/shared"
import { viewerTimeZone } from "../i18n/useViewerTimeZone"
import { endOffsetMs, endTimeAfter, formInstantMs, mergeDateTime } from "./calendarModel"
import { isEventAddressComplete } from "./eventAddressField"
import {
  DEFAULT_WIZARD_DURATION_MS,
  eventDraftWindow,
  hasValidEventEnd,
  slotsAfterZoneChange,
} from "./eventWizard"
import {
  addSlotDraft,
  claimedBySlotId,
  hasNamedSlot,
  makeSlotKey,
  shiftSlotDrafts,
  slotsValid,
  type SlotDraft,
  type SlotWindowBounds,
} from "./eventSlotsForm"

export interface CleanupFormValue {
  organizationId: string | null
  title: string
  description: string
  eventKind: EventKind
  addrQuery: string
  spot: string
  address: string
  addressSource: EventAddressSource | null
  addressPointKey: string | null
  coords: { lat: number; lng: number } | null
  date: Date | null
  time: Date | null
  endTime: Date | null
  timezone: string
  bring: string[]
  slots: SlotDraft[]
  linkedReportIds: string[]
  shareToFeed: boolean
  feedCaption: string
  coverMediaId: string | null
  coverPreviewUrl: string | null
}

export function emptyCleanupForm(
  seedLinkedReportId?: string,
  seedOrganizationId?: string,
): CleanupFormValue {
  return {
    organizationId: seedOrganizationId ?? null,
    title: "",
    description: "",
    eventKind: "cleanup",
    addrQuery: "",
    spot: "",
    address: "",
    addressSource: null,
    addressPointKey: null,
    coords: null,
    date: null,
    time: null,
    endTime: null,
    timezone: viewerTimeZone(),
    bring: [],
    slots: addSlotDraft([], makeSlotKey()),
    linkedReportIds: seedLinkedReportId ? [seedLinkedReportId] : [],
    shareToFeed: true,
    feedCaption: "",
    coverMediaId: null,
    coverPreviewUrl: null,
  }
}

export function cleanupFormWindow(value: CleanupFormValue): SlotWindowBounds | null {
  return eventDraftWindow(value)
}

/**
 * The >=1 named sign-up slot floor is unconditional: every event needs a board, the edit route is only
 * ever offered for an event that has not ended, and the server refuses a slot change afterwards anyway.
 */
export function isCleanupFormComplete(
  value: CleanupFormValue,
  existingSlots?: readonly EventSlotDTO[],
): boolean {
  return (
    value.title.trim().length > 0 &&
    value.coords !== null &&
    isEventAddressComplete(value.address) &&
    value.date !== null &&
    value.time !== null &&
    hasValidEventEnd(value) &&
    hasNamedSlot(value.slots) &&
    slotsValid(
      value.slots,
      existingSlots ? claimedBySlotId(existingSlots) : undefined,
      cleanupFormWindow(value),
    )
  )
}

/** Timed slots ride along when the event's start instant moves, so each keeps its place in the event. */
function slotsFollowingStart(
  slots: SlotDraft[],
  before: number | null,
  after: number | null,
): Pick<Partial<CleanupFormValue>, "slots"> {
  return before !== null && after !== null && before !== after
    ? { slots: shiftSlotDrafts(slots, after - before) }
    : {}
}

export function dateChangePatch(value: CleanupFormValue, date: Date): Partial<CleanupFormValue> {
  const before =
    value.date && value.time ? formInstantMs(value.date, value.time, value.timezone) : null
  const time = value.time ? mergeDateTime(date, value.time) : value.time
  const endTime = value.endTime ? mergeDateTime(date, value.endTime) : value.endTime
  const after = time ? formInstantMs(date, time, value.timezone) : null
  return { date, time, endTime, ...slotsFollowingStart(value.slots, before, after) }
}

/** A new start keeps the event's current length, or the wizard default before an end exists. */
export function startTimeChangePatch(value: CleanupFormValue, time: Date): Partial<CleanupFormValue> {
  const before =
    value.date && value.time ? formInstantMs(value.date, value.time, value.timezone) : null
  const after = value.date ? formInstantMs(value.date, time, value.timezone) : null
  const offset =
    value.time && value.endTime ? endOffsetMs(value.time, value.endTime) : DEFAULT_WIZARD_DURATION_MS
  const endTime = endTimeAfter(time, time, offset)
  return { time, endTime, ...slotsFollowingStart(value.slots, before, after) }
}

export function timezoneChangePatch(
  value: CleanupFormValue,
  timezone: string,
): Partial<CleanupFormValue> {
  return {
    timezone,
    slots: slotsAfterZoneChange(value.slots, value.date, value.time, value.timezone, timezone),
  }
}
