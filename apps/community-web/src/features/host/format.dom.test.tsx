import { describe, expect, it, vi } from "vitest"
import { render, renderHook, screen } from "@testing-library/react"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return { ...makeI18nMock(), useViewerTimeZone: () => "America/New_York" }
})

import { useConsoleFormat } from "./format"

const AT = "2026-09-12T17:00:00.000Z"

function Probe({ timeZone }: { timeZone?: string }) {
  const format = useConsoleFormat(timeZone)
  return (
    <>
      <span data-testid="when">{format.whenLabel(AT)}</span>
      <span data-testid="zone">{format.zoneLabel(AT) ?? "none"}</span>
      <span data-testid="override">{format.whenLabel(AT, "America/Chicago")}</span>
    </>
  )
}

const text = (id: string) => screen.getByTestId(id).textContent

const deviceLabel = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(AT))

describe("useConsoleFormat time zones", () => {
  it("renders an event instant in the EVENT's zone and names the zone when it differs", () => {
    render(<Probe timeZone="America/Los_Angeles" />)
    expect(text("when")).toBe("Sep 12, 2026, 10:00 AM PDT")
    expect(text("zone")).toBe("PDT")
  })

  it("drops the suffix when the event zone shares the viewer's offset", () => {
    render(<Probe timeZone="US/Eastern" />)
    expect(text("when")).toBe("Sep 12, 2026, 1:00 PM")
    expect(text("zone")).toBe("none")
  })

  it("falls back to the viewer's own zone, unsuffixed, for a legacy row with no zone", () => {
    render(<Probe />)
    expect(text("when")).toBe(deviceLabel)
    expect(text("zone")).toBe("none")
  })

  it("ignores an unusable zone rather than throwing in a render path", () => {
    render(<Probe timeZone="Mars/Olympus" />)
    expect(text("when")).toBe(deviceLabel)
  })

  it("lets a list row override the hook's zone per event", () => {
    render(<Probe timeZone="America/Los_Angeles" />)
    expect(text("override")).toBe("Sep 12, 2026, 12:00 PM CDT")
  })
})

describe("useConsoleFormat output", () => {
  const LA = "America/Los_Angeles"

  it("matches a freshly built Intl formatter for every value kind", () => {
    const { result } = renderHook(() => useConsoleFormat(LA))
    const format = result.current
    for (const value of [0, 7, 1234.5678, -42]) {
      expect(format.number(value)).toBe(new Intl.NumberFormat("en").format(value))
    }
    for (const value of [0, 0.1234, 1]) {
      expect(format.percent(value)).toBe(
        new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(value),
      )
    }
    const fresh = (options: Intl.DateTimeFormatOptions, timeZone: string) =>
      new Intl.DateTimeFormat("en", { ...options, timeZone }).format(new Date(AT))
    expect(format.date(AT)).toBe(fresh({ dateStyle: "medium" }, LA))
    expect(format.dateTime(AT)).toBe(fresh({ dateStyle: "medium", timeStyle: "short" }, LA))
    expect(format.time(AT)).toBe(fresh({ timeStyle: "short" }, LA))
    expect(format.dayShort(AT)).toBe(fresh({ month: "short", day: "numeric" }, LA))
    expect(format.time(AT, "Asia/Tokyo")).toBe(fresh({ timeStyle: "short" }, "Asia/Tokyo"))
  })
})
