import type { TFunction } from "i18next"
import type { LinkedEventRef } from "@civfix/shared"

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
  address?: string | null
  going?: number
  joined?: boolean
  attendees?: readonly LinkedEventRef["organizer"][]
  showAttendance?: boolean
}

export function buildLinkedEventCardTargetPlan() {
  return {
    removeTarget: { width: 44, height: 44 },
    removeVisual: { width: 24, height: 24 },
  } as const
}

// `new Intl.DateTimeFormat(...)` is one of the more expensive JS built-ins on Hermes, and this model is
// built for every attached-event card in the feed (three formatters per call). Cache the instances per
// (locale, timeZone, options) so a feed re-render reuses them instead of re-constructing.
const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatter(locale: string, timeZone: string | undefined, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${timeZone ?? ""}|${JSON.stringify(options)}`
  const cached = formatterCache.get(key)
  if (cached) return cached
  let made: Intl.DateTimeFormat
  try {
    made = new Intl.DateTimeFormat(locale, { ...options, ...(timeZone ? { timeZone } : {}) })
  } catch {
    made = new Intl.DateTimeFormat("en-US", options)
  }
  formatterCache.set(key, made)
  return made
}

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
  const attendees = context.attendees?.slice(0, 3) ?? []
  const month = valid ? formatter(locale, timeZone, { month: "short" }).format(date).toUpperCase() : "--"
  const day = valid ? formatter(locale, timeZone, { day: "numeric" }).format(date) : "--"
  const scheduleLabel = valid
    ? formatter(locale, timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(date)
    : t("linked.schedule_unavailable")
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
