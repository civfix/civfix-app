/**
 * `useEventWhen` is a memoised wrapper over the shared `eventWhenParts`; with `useMemo` made an identity
 * and the three context hooks replaced, the hook runs as a plain function and its composition can be
 * pinned without a renderer.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { eventWhenParts } from "@civfix/shared/datetime"

const ctx = vi.hoisted(() => ({
  locale: "en-US",
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as readonly string[],
  viewerTimeZone: "America/New_York",
}))

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useMemo: <T>(factory: () => T): T => factory(),
}))

vi.mock("../LocaleContext", () => ({ useLocale: () => ({ locale: ctx.locale }) }))
vi.mock("../useRelativeTime", () => ({ useRelativeTime: () => ({ weekdays: ctx.weekdays }) }))
vi.mock("../useViewerTimeZone", () => ({ useViewerTimeZone: () => ctx.viewerTimeZone }))

const { useEventWhen } = await import("../useEventWhen")

const EVENT = {
  scheduledAt: "2026-07-25T16:00:00.000Z",
  endsAt: "2026-07-25T19:00:00.000Z",
  timezone: "America/Los_Angeles",
}

beforeEach(() => {
  ctx.locale = "en-US"
  ctx.viewerTimeZone = "America/New_York"
})

describe("useEventWhen", () => {
  it("spreads the shared parts for the active locale, weekdays and viewer zone", () => {
    const when = useEventWhen(EVENT)
    const parts = eventWhenParts(EVENT, {
      locale: "en-US",
      weekdays: ctx.weekdays,
      viewerTimeZone: "America/New_York",
    })
    expect(when).toMatchObject(parts)
    expect(parts.zone).toBe("PDT")
  })

  it("appends the event zone to the time and the range when the viewer's offset differs", () => {
    const when = useEventWhen(EVENT)
    expect(when.timeWithZone).toBe(`${when.time} PDT`)
    expect(when.rangeWithZone).toBe(`${when.range} PDT`)
    expect(when.timeZone).toBe("America/Los_Angeles")
  })

  it("leaves both labels bare when the viewer shares the event's offset", () => {
    ctx.viewerTimeZone = "America/Los_Angeles"
    const when = useEventWhen(EVENT)
    expect(when.zone).toBeNull()
    expect(when.timeWithZone).toBe(when.time)
    expect(when.rangeWithZone).toBe(when.range)
  })

  it("has no range label for an event with no end", () => {
    const when = useEventWhen({ ...EVENT, endsAt: null })
    expect(when.range).toBeNull()
    expect(when.rangeWithZone).toBeNull()
    expect(when.timeWithZone).toBe(`${when.time} PDT`)
  })

  it("reports no event zone for a legacy row and never names one", () => {
    const when = useEventWhen({ scheduledAt: EVENT.scheduledAt, endsAt: EVENT.endsAt, timezone: null })
    expect(when.timeZone).toBeUndefined()
    expect(when.zone).toBeNull()
    expect(when.timeWithZone).toBe(when.time)
  })

  it("renders empty labels for an unparseable start", () => {
    const when = useEventWhen({ scheduledAt: "not-a-date", timezone: "America/Los_Angeles" })
    expect(when).toEqual({
      dow: "",
      date: "",
      time: "",
      range: null,
      zone: null,
      timeZone: "America/Los_Angeles",
      timeWithZone: "",
      rangeWithZone: null,
    })
  })
})
