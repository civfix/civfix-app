import { describe, expect, it } from "vitest"
import type { TFunction } from "i18next"
import type { LinkedEventRef } from "@civfix/shared"
import {
  buildLinkedEventCardModel,
  buildLinkedEventCardTargetPlan,
  visibleAttendeeSlots,
} from "../linkedEventCardModel"

/**
 * Stand-in for the `event-card` namespace bound by useT: interpolates {{vars}} and picks the _one/_other
 * plural off `count`, so the assertions below read like the shipped English copy without booting i18next.
 */
const EN: Record<string, string> = {
  going_one: "{{count}} going",
  going_other: "{{count}} going",
  "linked.schedule_unavailable": "Schedule unavailable",
  "linked.location_fallback": "Open event for location",
  "linked.a11y_card": "{{month}} {{day}}. {{title}}. {{schedule}}. {{location}}. {{going}}.",
  "linked.a11y_card_compact": "{{month}} {{day}}. {{title}}. {{schedule}}. {{location}}.",
  "linked.a11y_remove": "Remove {{title}}",
}

const t = ((key: string, options: Record<string, unknown> = {}) => {
  const resolved =
    typeof options.count === "number"
      ? EN[`${key}_${options.count === 1 ? "one" : "other"}`] ?? EN[key]
      : EN[key]
  if (resolved == null) throw new Error(`missing translation: ${key}`)
  return resolved.replace(/{{(\w+)}}/g, (_m, name: string) => String(options[name] ?? ""))
}) as unknown as TFunction

const event: LinkedEventRef = {
  id: "event-1",
  title: "Playa del Rey Beach Cleanup",
  eventKind: "cleanup",
  status: "upcoming",
  scheduledAt: "2026-07-25T16:00:00.000Z",
  lat: 33.95,
  lng: -118.45,
  going: 18,
  organizer: {
    id: "person-1",
    name: "Friends of Ballona",
    handle: "friendsofballona",
    avatar: ["#F0685C", "#E4574A"],
    avatarUrl: null,
    followers: 42,
    following: 7,
    isFollowing: false,
  },
  linkedAt: "2026-07-20T12:00:00.000Z",
}

describe("LinkedEventCard model", () => {
  it("renders the attached event's date, location, attendee preview, and RSVP state", () => {
    const model = buildLinkedEventCardModel(event, t, "en-US", "UTC", {
      address: "Ballona Creek Bike Path, Playa del Rey",
      joined: false,
      showAttendance: true,
      attendees: [
        event.organizer,
        { ...event.organizer, id: "person-2", name: "Maria G." },
      ],
    })

    expect(model).toMatchObject({
      title: "Playa del Rey Beach Cleanup",
      month: "JUL",
      day: "25",
      goingLabel: "18 going",
      locationLabel: "Ballona Creek Bike Path, Playa del Rey",
      rsvpActive: false,
    })
    expect(model.attendeePreview.map((person) => person.id)).toEqual(["person-1", "person-2"])
    expect(model).not.toHaveProperty("organizerLabel")
    expect(model.scheduleLabel).toContain("Sat")
    expect(model.accessibilityLabel).toContain("JUL 25")
    expect(model.accessibilityLabel).toContain(model.scheduleLabel)
    expect(model.accessibilityLabel).toContain(model.locationLabel)
    expect(model.accessibilityLabel).toContain("18 going")
    expect(model).not.toHaveProperty("rsvpLabel")
    expect(model.removeAccessibilityLabel).toBe("Remove Playa del Rey Beach Cleanup")
  })

  it("uses singular attendance copy", () => {
    expect(buildLinkedEventCardModel({ ...event, going: 1 }, t, "en-US", "UTC").goingLabel).toBe(
      "1 going",
    )
  })

  it("keeps zero attendance explicit on an attached event", () => {
    expect(buildLinkedEventCardModel({ ...event, going: 0 }, t, "en-US", "UTC").goingLabel).toBe(
      "0 going",
    )
  })

  it("prefers live attendance state and provides an actionable location fallback", () => {
    expect(buildLinkedEventCardModel(event, t, "en-US", "UTC", {
      going: 19,
      joined: true,
      address: "   ",
    })).toMatchObject({
      goingLabel: "19 going",
      locationLabel: "Open event for location",
      rsvpActive: true,
    })
  })

  it("renders the attached event in the EVENT's zone and names it when the offset differs", () => {
    const model = buildLinkedEventCardModel(event, t, "en-US", "America/Los_Angeles", {
      viewerTimeZone: "America/New_York",
    })
    expect(model).toMatchObject({ month: "JUL", day: "25" })
    expect(model.scheduleLabel).toBe("Sat 9:00 AM PDT")
  })

  it("leaves the zone off when the viewer's offset matches, alias zones included", () => {
    const aliased = buildLinkedEventCardModel(event, t, "en-US", "America/Los_Angeles", {
      viewerTimeZone: "US/Pacific",
    })
    expect(aliased.scheduleLabel).toBe("Sat 9:00 AM")
  })

  it("leaves the zone off for a legacy row that carries none", () => {
    const legacy = buildLinkedEventCardModel(event, t, "en-US", undefined, {
      viewerTimeZone: "America/New_York",
    })
    expect(legacy.scheduleLabel).not.toContain("EDT")
  })

  it("localizes the unparseable-schedule fallback instead of hardcoding English", () => {
    const model = buildLinkedEventCardModel({ ...event, scheduledAt: "not-a-date" }, t, "en-US", "UTC")
    expect(model).toMatchObject({ month: "--", day: "--", scheduleLabel: "Schedule unavailable" })
  })

  it("announces attendance only on the variant that actually shows it", () => {
    const context = { address: "Ballona Creek Bike Path", joined: false }
    const detail = buildLinkedEventCardModel(event, t, "en-US", "UTC", {
      ...context,
      showAttendance: true,
    })
    const feed = buildLinkedEventCardModel(event, t, "en-US", "UTC", context)

    expect(detail.accessibilityLabel).toContain("18 going")
    expect(feed.accessibilityLabel).not.toContain("going")
    for (const part of ["JUL 25", feed.title, feed.scheduleLabel, feed.locationLabel]) {
      expect(feed.accessibilityLabel).toContain(part)
    }
    expect(feed.goingLabel).toBe("18 going")
  })

  it("uses a physical 44px remove target around the compact close visual", () => {
    expect(buildLinkedEventCardTargetPlan()).toEqual({
      removeTarget: { width: 44, height: 44 },
      removeVisual: { width: 24, height: 24 },
    })
  })

  it("hands every render the same target plan, so the style array does not churn", () => {
    expect(buildLinkedEventCardTargetPlan()).toBe(buildLinkedEventCardTargetPlan())
  })
})

describe("visibleAttendeeSlots", () => {
  it("pads the preview faces with placeholders up to the going count", () => {
    expect(visibleAttendeeSlots(1, 3)).toBe(3)
    expect(visibleAttendeeSlots(0, 2)).toBe(2)
  })

  it("never draws more than three cells, however many are going or previewed", () => {
    expect(visibleAttendeeSlots(1, 40)).toBe(3)
    expect(visibleAttendeeSlots(3, 3)).toBe(3)
  })

  it("keeps every preview face even when the going count lags behind it", () => {
    expect(visibleAttendeeSlots(2, 0)).toBe(2)
    expect(visibleAttendeeSlots(0, 0)).toBe(0)
  })
})
