import { describe, expect, it } from "vitest"
import type { TFunction } from "i18next"
import type { LinkedEventRef } from "@civfix/shared"
import { buildLinkedEventCardModel } from "../linkedEventCardModel"
import { pinDeviceTimeZone } from "./deviceTimeZone"

const t = ((key: string, options: Record<string, unknown> = {}) =>
  `${key}${JSON.stringify(options)}`) as unknown as TFunction

const organizer: LinkedEventRef["organizer"] = {
  id: "org-person",
  name: "Friends of Ballona",
  handle: "friendsofballona",
  avatar: ["#F0685C", "#E4574A"],
  avatarUrl: null,
  followers: 0,
  following: 0,
  isFollowing: false,
}

const event: LinkedEventRef = {
  id: "event-1",
  title: "Beach Cleanup",
  eventKind: "cleanup",
  status: "upcoming",
  scheduledAt: "2026-07-25T12:00:00.000Z",
  lat: 33.95,
  lng: -118.45,
  going: 4,
  organizer,
  linkedAt: "2026-07-20T12:00:00.000Z",
}

const person = (id: string) => ({ ...organizer, id })

describe("buildLinkedEventCardModel locale and zone", () => {
  it("formats month, day and clock in the requested locale and zone", () => {
    const model = buildLinkedEventCardModel(event, t, "fr-FR", "UTC")
    expect(model).toMatchObject({ month: "JUIL.", day: "25", scheduleLabel: "sam. 12:00" })
  })

  it("names the event zone in the requested locale when the viewer's offset differs", () => {
    const model = buildLinkedEventCardModel(event, t, "fr-FR", "UTC", { viewerTimeZone: "America/New_York" })
    expect(model.scheduleLabel).toBe("sam. 12:00 UTC")
  })

  it("adds no zone suffix without a viewer zone", () => {
    const model = buildLinkedEventCardModel(event, t, "en-US", "America/Los_Angeles")
    expect(model.scheduleLabel).toBe("Sat 5:00 AM")
  })

  it("keeps a date that crosses midnight in the event zone on the event's own day", () => {
    const late = { ...event, scheduledAt: "2026-07-26T02:00:00.000Z" }
    const model = buildLinkedEventCardModel(late, t, "en-US", "America/Los_Angeles")
    expect(model).toMatchObject({ month: "JUL", day: "25", scheduleLabel: "Sat 7:00 PM" })
  })
})

describe("buildLinkedEventCardModel device-zone fallbacks, with the device in Los Angeles", () => {
  pinDeviceTimeZone("America/Los_Angeles")

  it("keeps the locale and falls back to the device zone when the event zone is not a valid IANA name", () => {
    const model = buildLinkedEventCardModel(event, t, "fr-FR", "Mars/Olympus")
    expect(model).toMatchObject({ month: "JUIL.", day: "25", scheduleLabel: "sam. 05:00" })
  })

  it("omits the zone name when the event zone is invalid, whatever the viewer zone", () => {
    const model = buildLinkedEventCardModel(event, t, "en-US", "Mars/Olympus", {
      viewerTimeZone: "America/New_York",
    })
    expect(model.scheduleLabel).toBe("Sat 5:00 AM")
  })

  it("keeps the event zone and falls back to US English for an invalid locale tag", () => {
    const model = buildLinkedEventCardModel(event, t, "not a locale!!", "America/New_York")
    expect(model).toMatchObject({ month: "JUL", day: "25", scheduleLabel: "Sat 8:00 AM" })
  })
})

describe("buildLinkedEventCardModel device-zone fallbacks, with the device on UTC", () => {
  pinDeviceTimeZone("UTC")

  it("falls back to US English for an invalid locale tag", () => {
    const model = buildLinkedEventCardModel(event, t, "not a locale!!", "UTC")
    expect(model).toMatchObject({ month: "JUL", day: "25", scheduleLabel: "Sat 12:00 PM" })
  })
})

describe("buildLinkedEventCardModel attendance", () => {
  it("previews at most three attendees, in order", () => {
    const model = buildLinkedEventCardModel(event, t, "en-US", "UTC", {
      attendees: [person("a"), person("b"), person("c"), person("d")],
    })
    expect(model.attendeePreview.map((p) => p.id)).toEqual(["a", "b", "c"])
  })

  it("previews the organizer when the attendee list is empty or absent", () => {
    expect(buildLinkedEventCardModel(event, t, "en-US", "UTC", { attendees: [] }).attendeePreview).toEqual([
      organizer,
    ])
    expect(buildLinkedEventCardModel(event, t, "en-US", "UTC").attendeePreview).toEqual([organizer])
  })

  it("uses the event's own going count and an inactive RSVP without live context", () => {
    const model = buildLinkedEventCardModel(event, t, "en-US", "UTC")
    expect(model.going).toBe(4)
    expect(model.goingLabel).toBe('going{"count":4}')
    expect(model.rsvpActive).toBe(false)
  })

  it("keeps a live zero over the event's own count", () => {
    expect(buildLinkedEventCardModel(event, t, "en-US", "UTC", { going: 0 }).going).toBe(0)
  })
})

describe("buildLinkedEventCardModel labels", () => {
  it("trims the address and falls back when it is null", () => {
    expect(buildLinkedEventCardModel(event, t, "en-US", "UTC", { address: "  1 Main St " }).locationLabel).toBe(
      "1 Main St",
    )
    expect(buildLinkedEventCardModel(event, t, "en-US", "UTC", { address: null }).locationLabel).toBe(
      "linked.location_fallback{}",
    )
  })

  it("passes the compact slots to the compact label and the going label to the full one", () => {
    const compact = buildLinkedEventCardModel(event, t, "en-US", "UTC", { address: "Pier" })
    expect(compact.accessibilityLabel).toBe(
      'linked.a11y_card_compact{"month":"JUL","day":"25","title":"Beach Cleanup","schedule":"Sat 12:00 PM","location":"Pier"}',
    )
    const full = buildLinkedEventCardModel(event, t, "en-US", "UTC", { address: "Pier", showAttendance: true })
    expect(full.accessibilityLabel).toBe(
      'linked.a11y_card{"month":"JUL","day":"25","title":"Beach Cleanup","schedule":"Sat 12:00 PM","location":"Pier","going":"going{\\"count\\":4}"}',
    )
  })
})
