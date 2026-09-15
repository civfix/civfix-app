/**
 * The pure lifecycle state machine of the event detail, plus the shared end-of-event clock this module
 * re-exports. Both take an INJECTED `now`, so these tests never touch timers.
 */
import { describe, expect, it } from "vitest"
import { DEFAULT_EVENT_DURATION_MS } from "@civfix/shared/host"
import { hasEventEnded, hoursReceiptState } from "../eventLifecycle"

const NOW = Date.parse("2026-07-27T12:00:00.000Z")
const STARTED = "2026-07-27T11:00:00.000Z"
const FUTURE = "2026-07-27T13:00:00.000Z"

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

  it("falls back to the shared default duration when endsAt is absent", () => {
    expect(hasEventEnded({ scheduledAt: STARTED }, NOW)).toBe(false)
    expect(hasEventEnded({ scheduledAt: STARTED, endsAt: null }, NOW)).toBe(false)
    expect(
      hasEventEnded(
        { scheduledAt: new Date(NOW - DEFAULT_EVENT_DURATION_MS - 1).toISOString() },
        NOW,
      ),
    ).toBe(true)
  })

  it("treats the end instant itself as ended - the window is strict", () => {
    expect(hasEventEnded({ scheduledAt: STARTED, endsAt: new Date(NOW).toISOString() }, NOW)).toBe(true)
  })

  it("fails closed on a schedule it cannot read, and treats an unparseable endsAt as absent", () => {
    expect(hasEventEnded({ scheduledAt: "not-a-date" }, NOW)).toBe(false)
    expect(hasEventEnded({ scheduledAt: STARTED, endsAt: "not-a-date" }, NOW)).toBe(false)
  })
})
