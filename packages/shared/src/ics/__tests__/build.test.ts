import { describe, expect, it } from "vitest"
import { ICS_PRODID, ICS_UID_DOMAIN, buildIcs, eventIcsUid } from "../build.js"

const BASE = {
  uid: "cleanup-42",
  title: "Creek Cleanup",
  startsAt: "2026-05-16T16:00:00.000Z",
  endsAt: "2026-05-16T19:30:00.000Z",
}

function lines(ics: string): string[] {
  return ics.split("\r\n")
}

function unfold(ics: string): string[] {
  const out: string[] = []
  for (const line of lines(ics)) {
    if (line.startsWith(" ") && out.length > 0) out[out.length - 1] += line.slice(1)
    else out.push(line)
  }
  return out
}

describe("buildIcs", () => {
  it("emits a CRLF-terminated VCALENDAR with the required properties", () => {
    const ics = buildIcs(BASE)
    expect(ics.endsWith("\r\n")).toBe(true)
    expect(ics.includes("\n\n")).toBe(false)
    const rows = unfold(ics)
    expect(rows[0]).toBe("BEGIN:VCALENDAR")
    expect(rows).toContain("VERSION:2.0")
    expect(rows).toContain(`PRODID:${ICS_PRODID}`)
    expect(rows).toContain("BEGIN:VEVENT")
    expect(rows).toContain("UID:cleanup-42@civfix.org")
    expect(rows).toContain("DTSTAMP:20260516T160000Z")
    expect(rows).toContain("DTSTART:20260516T160000Z")
    expect(rows).toContain("DTEND:20260516T193000Z")
    expect(rows).toContain("SUMMARY:Creek Cleanup")
    expect(rows).toContain("STATUS:CONFIRMED")
    expect(rows).toContain("SEQUENCE:0")
    expect(rows[rows.length - 2]).toBe("END:VCALENDAR")
  })

  it("is deterministic for the same input", () => {
    expect(buildIcs(BASE)).toBe(buildIcs(BASE))
  })

  it("keeps a uid that already carries a domain", () => {
    expect(unfold(buildIcs({ ...BASE, uid: "abc@events.civfix.org" }))).toContain(
      "UID:abc@events.civfix.org",
    )
  })

  it("stamps every instant in UTC and carries the zone only as a display hint", () => {
    const rows = unfold(buildIcs({ ...BASE, timezone: "America/Los_Angeles" }))
    expect(rows).toContain("DTSTART:20260516T160000Z")
    expect(rows).toContain("DTEND:20260516T193000Z")
    expect(rows).toContain("DTSTAMP:20260516T160000Z")
    expect(rows).toContain("X-WR-TIMEZONE:America/Los_Angeles")
    expect(rows.indexOf("X-WR-TIMEZONE:America/Los_Angeles")).toBeLessThan(
      rows.indexOf("BEGIN:VEVENT"),
    )
  })

  it("never emits a TZID it has no VTIMEZONE for", () => {
    const withZone = buildIcs({ ...BASE, timezone: "America/Los_Angeles" })
    expect(withZone.includes("TZID=")).toBe(false)
    expect(withZone.includes("BEGIN:VTIMEZONE")).toBe(false)
  })

  it("drops an unknown timezone rather than advertising it", () => {
    const rows = unfold(buildIcs({ ...BASE, timezone: "Mars/Olympus" }))
    expect(rows).toContain("DTSTART:20260516T160000Z")
    expect(rows.some((row) => row.startsWith("X-WR-TIMEZONE"))).toBe(false)
  })

  it("escapes text properties per RFC 5545", () => {
    const rows = unfold(
      buildIcs({
        ...BASE,
        title: "Cleanup; bring gloves, boots\\ok",
        description: "Line one\nLine two",
        location: "1st & Main, LA",
      }),
    )
    expect(rows).toContain("SUMMARY:Cleanup\\; bring gloves\\, boots\\\\ok")
    expect(rows).toContain("DESCRIPTION:Line one\\nLine two")
    expect(rows).toContain("LOCATION:1st & Main\\, LA")
  })

  it("folds long lines at 75 octets with a leading space and unfolds back", () => {
    const description = "z".repeat(400)
    const ics = buildIcs({ ...BASE, description })
    const encoder = new TextEncoder()
    for (const line of lines(ics)) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
    expect(unfold(ics)).toContain(`DESCRIPTION:${description}`)
  })

  it("does not split a multi-byte character across a fold", () => {
    const ics = buildIcs({ ...BASE, description: "é".repeat(120) })
    for (const line of lines(ics)) {
      expect(line.includes("�")).toBe(false)
    }
    expect(unfold(ics)).toContain(`DESCRIPTION:${"é".repeat(120)}`)
  })

  it("only carries an https URL and a well-formed organizer", () => {
    const rows = unfold(
      buildIcs({
        ...BASE,
        url: "javascript:alert(1)",
        organizer: { name: "Ada; Lovelace", email: "hi@civfix.org" },
      }),
    )
    expect(rows.some((row) => row.startsWith("URL:"))).toBe(false)
    expect(rows).toContain("ORGANIZER;CN=Ada Lovelace:mailto:hi@civfix.org")
    expect(unfold(buildIcs({ ...BASE, url: "https://civfix.org/e/creek" }))).toContain(
      "URL:https://civfix.org/e/creek",
    )
  })

  it("supports cancellations, sequences and open-ended events", () => {
    const rows = unfold(
      buildIcs({ uid: "x", title: "T", startsAt: BASE.startsAt, status: "CANCELLED", sequence: 3 }),
    )
    expect(rows).toContain("STATUS:CANCELLED")
    expect(rows).toContain("SEQUENCE:3")
    expect(rows.some((row) => row.startsWith("DTEND"))).toBe(false)
  })

  it("rejects invalid input instead of emitting a broken calendar", () => {
    expect(() => buildIcs({ ...BASE, startsAt: "nope" })).toThrow(RangeError)
    expect(() => buildIcs({ ...BASE, endsAt: "2026-05-15T00:00:00.000Z" })).toThrow(RangeError)
    expect(() => buildIcs({ ...BASE, uid: "   " })).toThrow(RangeError)
    expect(() => buildIcs({ ...BASE, title: "  " })).toThrow(RangeError)
  })

  it("cannot be used to inject a property through a title", () => {
    const rows = unfold(buildIcs({ ...BASE, title: "a\r\nX-EVIL:1" }))
    expect(rows.some((row) => row.startsWith("X-EVIL"))).toBe(false)
    expect(rows).toContain("SUMMARY:a\\nX-EVIL:1")
  })
})

describe("eventIcsUid", () => {
  it("is the one calendar identity every surface builds for an event", () => {
    expect(eventIcsUid("42")).toBe(`cleanup-42@${ICS_UID_DOMAIN}`)
  })

  it("survives buildIcs unchanged, so a server document and a client fallback are the same entry", () => {
    const uid = eventIcsUid("11111111-2222-3333-4444-555555555555")
    expect(lines(buildIcs({ ...BASE, uid }))).toContain(`UID:${uid}`)
  })
})
