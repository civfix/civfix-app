import { describe, expect, it } from "vitest"
import { buildRsvpPillLayoutPlan, rsvpPillState } from "../rsvpPillModel"
import de from "../../i18n/locales/de/event-rsvp.json"
import en from "../../i18n/locales/en/event-rsvp.json"
import es from "../../i18n/locales/es/event-rsvp.json"
import ko from "../../i18n/locales/ko/event-rsvp.json"

describe("RsvpPill layout", () => {
  it.each([
    ["sm", 30],
    ["md", 34],
  ] as const)("keeps the %s visual dense inside a physical 44px target", (size, visualHeight) => {
    expect(buildRsvpPillLayoutPlan(size)).toEqual({
      target: { minWidth: 44, minHeight: 44 },
      visual: { height: visualHeight },
    })
  })
})

describe("RsvpPill ended state copy", () => {
  it.each([
    ["en", en],
    ["es", es],
    ["de", de],
    ["ko", ko],
  ])("resolves the muted %s pill's label and a11y name", (_locale, catalog) => {
    expect(catalog.label.ended.length).toBeGreaterThan(0)
    expect(catalog.a11y.ended.length).toBeGreaterThan(0)
    expect(catalog.error.ended.length).toBeGreaterThan(0)
  })

  it("does not reuse the RSVP copy for the ended pill", () => {
    expect(en.label.ended).not.toBe(en.label.rsvp)
    expect(en.label.ended).not.toBe(en.label.going)
    expect(en.error.ended).not.toBe(en.error.closed)
  })
})

describe("RsvpPill state", () => {
  it("keeps a joined attendee on the Going pill after the event ends, so they can still leave", () => {
    expect(rsvpPillState({ going: true, ended: true })).toBe("going")
    expect(rsvpPillState({ going: true, ended: false })).toBe("going")
  })

  it("shows the muted Ended pill only to someone who never RSVP'd", () => {
    expect(rsvpPillState({ going: false, ended: true })).toBe("ended")
    expect(rsvpPillState({ going: false, ended: false })).toBe("rsvp")
  })
})
