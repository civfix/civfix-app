import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { hasEventEnded, type EventWindowLike } from "@civfix/shared/host"
import { hostLogHoursGate } from "../hostLogHoursGate"

const NOW = Date.parse("2026-09-13T18:00:00.000Z")
const HOUR = 3_600_000

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const body = code(read("../HostLogHoursBody.tsx"))

const iso = (at: number): string => new Date(at).toISOString()

function window(startsAt: number, endsAt: number): EventWindowLike {
  return { status: "upcoming", scheduledAt: iso(startsAt), endsAt: iso(endsAt) }
}

const OPEN = { loading: false, failed: false, manages: true, ended: true }

describe("what the Log hours screen may show", () => {
  it("waits for both queries before deciding anything", () => {
    expect(hostLogHoursGate({ ...OPEN, loading: true, manages: false, ended: false })).toBe("loading")
  })

  it("shows an error state rather than an editor seeded from nothing", () => {
    expect(hostLogHoursGate({ ...OPEN, failed: true })).toBe("error")
    expect(hostLogHoursGate({ ...OPEN, failed: true, manages: false })).toBe("error")
  })

  it("keeps the access gate ahead of the clock", () => {
    expect(hostLogHoursGate({ ...OPEN, manages: false })).toBe("denied")
    expect(hostLogHoursGate({ ...OPEN, manages: false, ended: false })).toBe("denied")
  })

  it("refuses the editor until the event's window has closed - the server does", () => {
    expect(hostLogHoursGate({ ...OPEN, ended: false })).toBe("not-yet")
    expect(hostLogHoursGate(OPEN)).toBe("editor")
  })

  it("opens at the very instant the shared clock calls the event over", () => {
    const event = window(NOW - 4 * HOUR, NOW)
    const gateAt = (now: number) =>
      hostLogHoursGate({ ...OPEN, ended: hasEventEnded(event, now) })
    expect(gateAt(NOW - 1)).toBe("not-yet")
    expect(gateAt(NOW)).toBe("editor")
  })

  it("stays shut for an event with no end that the default duration has not covered yet", () => {
    const started: EventWindowLike = { status: "upcoming", scheduledAt: iso(NOW - HOUR) }
    expect(hostLogHoursGate({ ...OPEN, ended: hasEventEnded(started, NOW) })).toBe("not-yet")
  })
})

describe("the screen wires that gate to the shared clock", () => {
  it("derives the window from the clock rather than the stored status", () => {
    expect(body).toContain("hasEventEnded(event, now)")
    expect(body).toContain("nextEventBoundaryMs(event, Date.now())")
    expect(body).toContain("useNow(boundaryAt === null ? 0 : NOW_TICK_MS, { boundaryAt })")
    expect(body).not.toMatch(/status === "done"/)
  })

  it("routes every arm through the one gate, and treats a failed hours load as an error", () => {
    expect(body).toContain("hours.isError")
    expect(body).toContain("cleanup.isError")
    expect(body).toContain('gate === "not-yet"')
    expect(body).toContain('t("hours.not_yet_body")')
  })

  it("renders the not-yet copy from keys that exist in every locale", () => {
    for (const locale of ["en", "es", "de", "ko"]) {
      const catalog = JSON.parse(
        read(`../../../i18n/locales/${locale}/host-common.json`),
      ) as { hours?: Record<string, string> }
      expect(catalog.hours?.not_yet_title, locale).toBeTruthy()
      expect(catalog.hours?.not_yet_body, locale).toBeTruthy()
    }
  })
})
