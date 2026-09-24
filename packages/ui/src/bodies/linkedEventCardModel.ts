import type { TFunction } from "i18next"
import type { LinkedEventRef } from "@civfix/shared"
import { eventZoneSuffix, safeDateFormat } from "@civfix/shared/datetime"
import { MIN_TOUCH_TARGET } from "../theme/touchTarget"

export interface LinkedEventCardModel {
  title: string
  month: string
  day: string
  scheduleLabel: string
  locationLabel: string
  going: number
  goingLabel: string
  rsvpActive: boolean
  attendeePreview: LinkedEventRef["organizer"][]
  accessibilityLabel: string
  removeAccessibilityLabel: string
}

export interface LinkedEventCardContext {
  viewerTimeZone?: string
  address?: string | null
  going?: number
  joined?: boolean
  attendees?: readonly LinkedEventRef["organizer"][]
  showAttendance?: boolean
}

/** Faces the card's attendee stack shows at most; the going label carries the rest. */
export const ATTENDEE_FACE_CAP = 3

const REMOVE_VISUAL_SIZE = 24

const LINKED_EVENT_CARD_TARGETS = {
  removeTarget: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET },
  removeVisual: { width: REMOVE_VISUAL_SIZE, height: REMOVE_VISUAL_SIZE },
} as const

export function buildLinkedEventCardTargetPlan() {
  return LINKED_EVENT_CARD_TARGETS
}

/**
 * How many face cells the stack draws: every preview face, padded with placeholders up to the going count,
 * never past the cap.
 */
export function visibleAttendeeSlots(previewCount: number, going: number): number {
  return Math.min(ATTENDEE_FACE_CAP, Math.max(previewCount, Math.min(ATTENDEE_FACE_CAP, going)))
}

const MONTH_OPTIONS: Intl.DateTimeFormatOptions = { month: "short" }
const DAY_OPTIONS: Intl.DateTimeFormatOptions = { day: "numeric" }
const CLOCK_OPTIONS: Intl.DateTimeFormatOptions = { weekday: "short", hour: "numeric", minute: "2-digit" }

/**
 * The attached-event card's presentation. `t` is bound to the `event-card` namespace (this card's own
 * strings live under `linked.*`, and it shares the `going_one`/`going_other` plural with EventCard) so
 * the card and its screen-reader label localize with the rest of the app.
 */
export function buildLinkedEventCardModel(
  event: LinkedEventRef,
  t: TFunction,
  locale = "en-US",
  timeZone?: string,
  context: LinkedEventCardContext = {},
): LinkedEventCardModel {
  const date = new Date(event.scheduledAt)
  const valid = !Number.isNaN(date.getTime())
  const going = context.going ?? event.going
  const joined = context.joined ?? false
  const attendees = context.attendees?.slice(0, ATTENDEE_FACE_CAP) ?? []
  const month = valid ? safeDateFormat(event.scheduledAt, locale, MONTH_OPTIONS, timeZone).toUpperCase() : "--"
  const day = valid ? safeDateFormat(event.scheduledAt, locale, DAY_OPTIONS, timeZone) : "--"
  const zone = valid ? eventZoneSuffix(date.getTime(), timeZone, context.viewerTimeZone, locale) : null
  const clock = valid
    ? safeDateFormat(event.scheduledAt, locale, CLOCK_OPTIONS, timeZone)
    : t("linked.schedule_unavailable")
  const scheduleLabel = zone === null ? clock : `${clock} ${zone}`
  const locationLabel = context.address?.trim() || t("linked.location_fallback")
  const goingLabel = t("going", { count: going })
  const dateSlots = { month, day, title: event.title, schedule: scheduleLabel, location: locationLabel }
  return {
    title: event.title,
    month,
    day,
    scheduleLabel,
    locationLabel,
    going,
    goingLabel,
    rsvpActive: joined,
    attendeePreview: attendees.length > 0 ? attendees : [event.organizer],
    accessibilityLabel: context.showAttendance
      ? t("linked.a11y_card", { ...dateSlots, going: goingLabel })
      : t("linked.a11y_card_compact", dateSlots),
    removeAccessibilityLabel: t("linked.a11y_remove", { title: event.title }),
  }
}
