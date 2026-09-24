import { describe, expect, it } from "vitest"
import type { MyEventTicketDTO } from "@civfix/shared"
import { pinDeviceTimeZone } from "../../__tests__/deviceTimeZone"
import { formatTicketCode, ticketSeatCount, ticketWhen, ticketWhere } from "../ticketModel"

describe("ticketWhen", () => {
  it("prints the day and the zoned clock in the ticket's own zone", () => {
    expect(
      ticketWhen({ startsAt: "2026-07-25T16:00:00.000Z", timezone: "America/Los_Angeles" }, "en-US"),
    ).toBe("Sat, Jul 25 · 9:00 AM PDT")
  })

  it("puts the calendar day in the ticket's zone, not the device's", () => {
    expect(ticketWhen({ startsAt: "2026-07-26T02:00:00.000Z", timezone: "America/New_York" }, "en-US")).toBe(
      "Sat, Jul 25 · 10:00 PM EDT",
    )
  })

  it("follows the requested locale", () => {
    expect(ticketWhen({ startsAt: "2026-07-25T16:00:00.000Z", timezone: "UTC" }, "de-DE")).toBe(
      "Sa., 25. Juli · 16:00 UTC",
    )
  })

  it("ignores the end instant", () => {
    const base = { startsAt: "2026-07-25T16:00:00.000Z", timezone: "UTC" }
    expect(ticketWhen({ ...base, endsAt: "2026-07-25T20:00:00.000Z" }, "en-US")).toBe(ticketWhen(base, "en-US"))
  })

  it("is empty for an unparseable start", () => {
    expect(ticketWhen({ startsAt: "not-a-date", timezone: "UTC" }, "en-US")).toBe("")
  })
})

describe("ticketWhen with the device in Los Angeles", () => {
  pinDeviceTimeZone("America/Los_Angeles")

  it("falls back to the device zone for an unknown zone rather than failing", () => {
    expect(ticketWhen({ startsAt: "2026-07-25T12:00:00.000Z", timezone: "Mars/Olympus" }, "en-US")).toBe(
      "Sat, Jul 25 · 5:00 AM PDT",
    )
  })
})

describe("ticketWhere", () => {
  it("trims the address and treats blank or missing as none", () => {
    expect(ticketWhere({ address: "  1 Main St " })).toBe("1 Main St")
    expect(ticketWhere({ address: "   " })).toBeNull()
    expect(ticketWhere({ address: null })).toBeNull()
    expect(ticketWhere({})).toBeNull()
  })
})

describe("ticketSeatCount", () => {
  it("counts the seats on the ticket", () => {
    const ticket = { seats: [{ id: "a" }, { id: "b" }, { id: "c" }] } as unknown as MyEventTicketDTO
    expect(ticketSeatCount(ticket)).toBe(3)
  })
})

describe("formatTicketCode edges", () => {
  it("trims before grouping and leaves an exact multiple with no trailing dash", () => {
    expect(formatTicketCode("  abcdefgh ")).toBe("ABCD-EFGH")
  })

  it("does not strip existing hyphens, so a printed code re-grouped is not idempotent", () => {
    expect(formatTicketCode("ABCD-EFGH")).toBe("ABCD--EFG-H")
  })

  it("prints a short token as a single group", () => {
    expect(formatTicketCode("ab")).toBe("AB")
  })
})
