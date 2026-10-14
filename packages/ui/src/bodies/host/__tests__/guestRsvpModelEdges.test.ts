import { describe, expect, it } from "vitest"
import { EMAIL_MAX_LENGTH, MAX_GUEST_NAME } from "@civfix/shared"
import {
  GUEST_RSVP_CODE_LENGTH,
  canSubmitGuestForm,
  emptyGuestRsvpForm,
  formatGuestPhone,
  guestContactPayload,
  guestEmailValue,
  guestNameValue,
  guestPhoneDigits,
  guestPhoneE164,
  guestRequestErrorKey,
  guestResendReadyAt,
  guestResendSecondsLeft,
  guestSmsUnavailable,
} from "../registration/guestRsvpModel"

describe("guest RSVP form defaults", () => {
  it("starts blank on the email channel unless told otherwise", () => {
    expect(emptyGuestRsvpForm()).toEqual({ name: "", channel: "email", email: "", phone: "" })
    expect(emptyGuestRsvpForm("sms")).toEqual({ name: "", channel: "sms", email: "", phone: "" })
  })

  it("expects a six-digit code", () => {
    expect(GUEST_RSVP_CODE_LENGTH).toBe(6)
  })
})

describe("guest phone edges", () => {
  it("keeps an eleven-digit number that does not start with 1 and caps it at ten digits", () => {
    expect(guestPhoneDigits("24155551234")).toBe("2415555123")
  })

  it("formats the six-digit boundary without a trailing dash", () => {
    expect(formatGuestPhone("415555")).toBe("(415) 555")
    expect(formatGuestPhone("4155551")).toBe("(415) 555-1")
    expect(formatGuestPhone("415")).toBe("(415")
  })

  it("formats nothing for input with no digits", () => {
    expect(formatGuestPhone("abc-()")).toBe("")
  })

  it("accepts any exchange digit once the area code is valid", () => {
    expect(guestPhoneE164("(415) 055-1234")).toBe("+14150551234")
  })

  it("rejects an empty phone", () => {
    expect(guestPhoneE164("")).toBeNull()
  })
})

describe("guest name and email boundaries", () => {
  it("accepts a name exactly at the contract maximum", () => {
    expect(guestNameValue("a".repeat(MAX_GUEST_NAME))).toBe("a".repeat(MAX_GUEST_NAME))
    expect(guestNameValue("a".repeat(MAX_GUEST_NAME + 1))).toBeNull()
  })

  it("measures the name after trimming", () => {
    expect(guestNameValue(`  ${"a".repeat(MAX_GUEST_NAME)}  `)).toBe("a".repeat(MAX_GUEST_NAME))
  })

  it("accepts an email exactly at the maximum length and rejects one past it", () => {
    const local = "a".repeat(EMAIL_MAX_LENGTH - "@b.co".length)
    expect(guestEmailValue(`${local}@b.co`)).toBe(`${local}@b.co`)
    expect(guestEmailValue(`a${local}@b.co`)).toBeNull()
  })

  it("rejects an email with inner whitespace or two at-signs", () => {
    expect(guestEmailValue("a b@c.co")).toBeNull()
    expect(guestEmailValue("a@b@c.co")).toBeNull()
  })
})

describe("guest contact payload edges", () => {
  it("returns null for an sms form with an invalid phone even when the email is valid", () => {
    expect(guestContactPayload({ name: "Ada", channel: "sms", email: "a@b.co", phone: "123" })).toBeNull()
  })

  it("lets an sms form submit with a blank email", () => {
    expect(canSubmitGuestForm({ name: "Ada", channel: "sms", email: "", phone: "4155551234" }, false)).toBe(true)
  })
})

describe("guest request error key edges", () => {
  it("falls back to generic for an unknown or missing code", () => {
    expect(guestRequestErrorKey(undefined)).toBe("error.generic")
    expect(guestRequestErrorKey("UNAUTHORIZED")).toBe("error.generic")
    expect(guestRequestErrorKey("INTERNAL", {})).toBe("error.generic")
  })
})

describe("guest sms refusal edges", () => {
  it("reads a channel field as a refusal whatever its value", () => {
    expect(guestSmsUnavailable("sms", { channel: "" })).toBe(true)
    expect(guestSmsUnavailable("sms", { channel: "sms_disabled", phone: "x" })).toBe(true)
  })

  it("does not read an sms refusal without fields", () => {
    expect(guestSmsUnavailable("sms", undefined)).toBe(false)
  })
})

describe("guest resend cooldown edges", () => {
  it("rounds a partial second up", () => {
    expect(guestResendSecondsLeft(10_001, 9_000)).toBe(2)
    expect(guestResendSecondsLeft(10_000, 9_000)).toBe(1)
  })

  it("adds the cooldown in whole seconds from now", () => {
    expect(guestResendReadyAt(5_000, 60)).toBe(65_000)
    expect(guestResendReadyAt(5_000, 0)).toBe(5_000)
  })
})
