import { describe, expect, it } from "vitest"
import { pinDeviceTimeZone } from "../../__tests__/deviceTimeZone"
import { ticketAddressView, ticketWhen } from "../ticketModel"

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

describe("ticketAddressView without an event", () => {
  it("trims the ticket address and treats blank or missing as none", () => {
    expect(ticketAddressView({ address: "  1 Main St " }, null).address).toBe("1 Main St")
    expect(ticketAddressView({ address: "   " }, null).address).toBeNull()
    expect(ticketAddressView({ address: null }, null).address).toBeNull()
    expect(ticketAddressView({}, null).address).toBeNull()
  })
})
