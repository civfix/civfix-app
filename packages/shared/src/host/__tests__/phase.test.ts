import { describe, expect, it } from "vitest"
import {
  DEFAULT_DURATION_MS,
  DEFAULT_EVENT_DURATION_MS,
  LIVE_LEAD_MS,
  LIVE_TAIL_MS,
  deriveCleanupStatus,
  eventEndsAtMs,
  eventPhase,
  eventStartsAtMs,
  hasEventEnded,
  hasEventStarted,
  hostStage,
  nextEventBoundaryMs,
  type EventWindowLike,
} from "../phase.js"
import { DEFAULT_EVENT_DURATION_MINUTES } from "../../schemas/cleanups.js"

const START = Date.parse("2026-09-05T20:00:00.000Z")
const END = START + 3 * 3_600_000

function window(overrides: Partial<EventWindowLike> = {}): EventWindowLike {
  return {
    status: "upcoming",
    scheduledAt: new Date(START).toISOString(),
    endsAt: new Date(END).toISOString(),
    ...overrides,
  }
}

describe("duration constants", () => {
  it("derives the default window from the single minutes constant", () => {
    expect(DEFAULT_EVENT_DURATION_MS).toBe(DEFAULT_EVENT_DURATION_MINUTES * 60_000)
    expect(DEFAULT_EVENT_DURATION_MS).toBe(4 * 3_600_000)
  })

  it("keeps DEFAULT_DURATION_MS as an alias for the consumers that import it", () => {
    expect(DEFAULT_DURATION_MS).toBe(DEFAULT_EVENT_DURATION_MS)
  })
})

describe("window instants", () => {
  it("reads the start and end instants", () => {
    expect(eventStartsAtMs(window())).toBe(START)
    expect(eventEndsAtMs(window())).toBe(END)
  })

  it("falls back to the default duration when endsAt is missing", () => {
    expect(eventEndsAtMs(window({ endsAt: null }))).toBe(START + DEFAULT_EVENT_DURATION_MS)
    expect(eventEndsAtMs({ scheduledAt: new Date(START).toISOString() })).toBe(
      START + DEFAULT_EVENT_DURATION_MS,
    )
  })

  it("returns null for an unparseable start", () => {
    expect(eventStartsAtMs({ scheduledAt: "not a date" })).toBeNull()
    expect(eventEndsAtMs({ scheduledAt: "not a date", endsAt: null })).toBeNull()
  })

  it("treats the left edge as inclusive and fails closed on a bad window", () => {
    expect(hasEventStarted(window(), START - 1)).toBe(false)
    expect(hasEventStarted(window(), START)).toBe(true)
    expect(hasEventEnded(window(), END - 1)).toBe(false)
    expect(hasEventEnded(window(), END)).toBe(true)
    expect(hasEventEnded({ scheduledAt: "not a date" }, END)).toBe(false)
  })
})

describe("deriveCleanupStatus", () => {
  it("walks upcoming -> active -> done off the clock alone", () => {
    expect(deriveCleanupStatus(window(), START - 1)).toBe("upcoming")
    expect(deriveCleanupStatus(window(), START)).toBe("active")
    expect(deriveCleanupStatus(window(), END - 1)).toBe("active")
    expect(deriveCleanupStatus(window(), END)).toBe("done")
  })

  it("ignores a stored active/done value and honours only cancelled", () => {
    expect(deriveCleanupStatus(window({ status: "done" }), START - 1)).toBe("upcoming")
    expect(deriveCleanupStatus(window({ status: "active" }), END)).toBe("done")
    expect(deriveCleanupStatus(window({ status: "cancelled" }), START)).toBe("cancelled")
  })
})

describe("eventPhase", () => {
  it("opens the live window a lead before the start and closes it a tail after the end", () => {
    expect(eventPhase(window(), START - LIVE_LEAD_MS - 1)).toBe("upcoming")
    expect(eventPhase(window(), START - LIVE_LEAD_MS)).toBe("live")
    expect(eventPhase(window(), END)).toBe("live")
    expect(eventPhase(window(), END + LIVE_TAIL_MS - 1)).toBe("live")
    expect(eventPhase(window(), END + LIVE_TAIL_MS)).toBe("ended")
  })

  it("no longer short-circuits on a stored done status", () => {
    expect(eventPhase(window({ status: "done" }), START)).toBe("live")
    expect(eventPhase(window({ status: "done" }), START - LIVE_LEAD_MS - 1)).toBe("upcoming")
  })

  it("is cancelled whenever the stored status is, and upcoming for an unusable clock", () => {
    expect(eventPhase(window({ status: "cancelled" }), END + LIVE_TAIL_MS)).toBe("cancelled")
    expect(eventPhase(window({ scheduledAt: "not a date" }), START)).toBe("upcoming")
    expect(eventPhase(window(), Number.NaN)).toBe("upcoming")
  })
})

describe("phase and status invariants", () => {
  const probes = [
    START - LIVE_LEAD_MS - 1,
    START - LIVE_LEAD_MS,
    START - 1,
    START,
    END - 1,
    END,
    END + LIVE_TAIL_MS - 1,
    END + LIVE_TAIL_MS,
  ]

  it('holds phase === "ended" => status === "done"', () => {
    for (const now of probes) {
      if (eventPhase(window(), now) === "ended") {
        expect(deriveCleanupStatus(window(), now)).toBe("done")
      }
    }
  })

  it('holds status === "active" => phase === "live"', () => {
    for (const now of probes) {
      if (deriveCleanupStatus(window(), now) === "active") {
        expect(eventPhase(window(), now)).toBe("live")
      }
    }
  })

  it('holds phase === "upcoming" => status === "upcoming"', () => {
    for (const now of probes) {
      if (eventPhase(window(), now) === "upcoming") {
        expect(deriveCleanupStatus(window(), now)).toBe("upcoming")
      }
    }
  })

  it("holds cancelled <=> cancelled", () => {
    for (const now of probes) {
      const cancelled = window({ status: "cancelled" })
      expect(eventPhase(cancelled, now)).toBe("cancelled")
      expect(deriveCleanupStatus(cancelled, now)).toBe("cancelled")
      expect(eventPhase(window(), now)).not.toBe("cancelled")
      expect(deriveCleanupStatus(window(), now)).not.toBe("cancelled")
    }
  })
})

describe("hostStage", () => {
  it("names the five live-tooling windows", () => {
    expect(hostStage(window(), START - LIVE_LEAD_MS - 1)).toBe("upcoming")
    expect(hostStage(window(), START - LIVE_LEAD_MS)).toBe("soon")
    expect(hostStage(window(), START)).toBe("underway")
    expect(hostStage(window(), END - 1)).toBe("underway")
    expect(hostStage(window(), END)).toBe("wrapping_up")
    expect(hostStage(window(), END + LIVE_TAIL_MS)).toBe("past")
  })

  it("is cancelled for a cancelled event at any instant", () => {
    expect(hostStage(window({ status: "cancelled" }), START)).toBe("cancelled")
  })
})

describe("nextEventBoundaryMs", () => {
  it("returns the next of the four window edges", () => {
    expect(nextEventBoundaryMs(window(), START - LIVE_LEAD_MS - 1)).toBe(START - LIVE_LEAD_MS)
    expect(nextEventBoundaryMs(window(), START - LIVE_LEAD_MS)).toBe(START)
    expect(nextEventBoundaryMs(window(), START)).toBe(END)
    expect(nextEventBoundaryMs(window(), END)).toBe(END + LIVE_TAIL_MS)
  })

  it("returns null once every edge has passed, and for a cancelled event", () => {
    expect(nextEventBoundaryMs(window(), END + LIVE_TAIL_MS)).toBeNull()
    expect(nextEventBoundaryMs(window({ status: "cancelled" }), START - 1)).toBeNull()
    expect(nextEventBoundaryMs(window({ scheduledAt: "not a date" }), START)).toBeNull()
  })
})
