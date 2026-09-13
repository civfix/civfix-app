/**
 * The two pure lifecycle state machines of the event detail. Both take an INJECTED `now`, so these
 * tests never touch timers.
 */
import { describe, expect, it } from "vitest"
import { EVENT_END_GRACE_MS, eventCompletionState, hasEventEnded, hoursReceiptState } from "../eventLifecycle"

const NOW = Date.parse("2026-07-27T12:00:00.000Z")
const STARTED = "2026-07-27T11:00:00.000Z"
const FUTURE = "2026-07-27T13:00:00.000Z"

describe("eventCompletionState", () => {
  it("hides the action from anyone who is not an acting host", () => {
    expect(
      eventCompletionState({ actsAsHost: false, status: "upcoming", scheduledAt: STARTED, now: NOW }),
    ).toBe("hidden")
  })

  it("arms the action for an acting host once the event has started", () => {
    expect(
      eventCompletionState({ actsAsHost: true, status: "upcoming", scheduledAt: STARTED, now: NOW }),
    ).toBe("ready")
    expect(
      eventCompletionState({ actsAsHost: true, status: "active", scheduledAt: STARTED, now: NOW }),
    ).toBe("ready")
  })

  it("treats scheduledAt === now as ready (the server gate is <=, not <)", () => {
    expect(
      eventCompletionState({
        actsAsHost: true,
        status: "upcoming",
        scheduledAt: new Date(NOW).toISOString(),
        now: NOW,
      }),
    ).toBe("ready")
  })

  it("disarms the action before the start time", () => {
    expect(
      eventCompletionState({ actsAsHost: true, status: "upcoming", scheduledAt: FUTURE, now: NOW }),
    ).toBe("too-early")
  })

  it("hides the action once the event is done or cancelled", () => {
    expect(
      eventCompletionState({ actsAsHost: true, status: "done", scheduledAt: STARTED, now: NOW }),
    ).toBe("hidden")
    expect(
      eventCompletionState({ actsAsHost: true, status: "cancelled", scheduledAt: STARTED, now: NOW }),
    ).toBe("hidden")
  })

  it("fails closed to too-early on an unparseable schedule", () => {
    expect(
      eventCompletionState({ actsAsHost: true, status: "upcoming", scheduledAt: "nope", now: NOW }),
    ).toBe("too-early")
  })
})

describe("hoursReceiptState", () => {
  const attended = { status: "done", actsAsHost: false, joined: true } as const

  it("hides the receipt until the event is done", () => {
    for (const status of ["upcoming", "active", "cancelled"] as const) {
      expect(
        hoursReceiptState({ ...attended, status, myHours: 2, anyLogged: true }),
      ).toBe("hidden")
    }
  })

  it("hides the receipt from an acting host and from a non-attendee", () => {
    expect(
      hoursReceiptState({ ...attended, actsAsHost: true, myHours: 2, anyLogged: true }),
    ).toBe("hidden")
    expect(hoursReceiptState({ ...attended, joined: false, myHours: null, anyLogged: true })).toBe(
      "hidden",
    )
  })

  it("credits an attendee who has a row", () => {
    expect(hoursReceiptState({ ...attended, myHours: 2.5, anyLogged: true })).toBe("credited")
  })

  it("shows pending when nothing has been logged for the event yet", () => {
    expect(hoursReceiptState({ ...attended, myHours: null, anyLogged: false })).toBe("pending")
  })

  it("shows not-credited only when hours WERE logged and the viewer got none", () => {
    expect(hoursReceiptState({ ...attended, myHours: null, anyLogged: true })).toBe("not-credited")
  })

  it("treats a zero-hour row as not a credit", () => {
    expect(hoursReceiptState({ ...attended, myHours: 0, anyLogged: true })).toBe("not-credited")
    expect(hoursReceiptState({ ...attended, myHours: 0, anyLogged: false })).toBe("pending")
  })
})

describe("hasEventEnded", () => {
  it("prefers endsAt over the scheduled start", () => {
    expect(hasEventEnded({ scheduledAt: STARTED, endsAt: "2026-07-27T11:30:00.000Z" }, NOW)).toBe(true)
    expect(hasEventEnded({ scheduledAt: "2026-07-20T11:00:00.000Z", endsAt: FUTURE }, NOW)).toBe(false)
  })

  it("falls back to the start plus the grace window when endsAt is absent", () => {
    expect(hasEventEnded({ scheduledAt: STARTED }, NOW)).toBe(false)
    expect(hasEventEnded({ scheduledAt: STARTED, endsAt: null }, NOW)).toBe(false)
    expect(hasEventEnded({ scheduledAt: new Date(NOW - EVENT_END_GRACE_MS - 1).toISOString() }, NOW)).toBe(
      true,
    )
  })

  it("treats an event ending exactly now as still live", () => {
    expect(hasEventEnded({ scheduledAt: STARTED, endsAt: new Date(NOW).toISOString() }, NOW)).toBe(false)
  })

  it("treats an unparseable schedule as ended, and an unparseable endsAt as absent", () => {
    expect(hasEventEnded({ scheduledAt: "not-a-date" }, NOW)).toBe(true)
    expect(hasEventEnded({ scheduledAt: STARTED, endsAt: "not-a-date" }, NOW)).toBe(false)
  })
})
