import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  canSubmitGuestForm,
  emptyGuestRsvpForm,
  formatGuestPhone,
  guestAttemptsExhausted,
  guestContactPayload,
  guestEmailValue,
  guestNameValue,
  guestPhoneDigits,
  guestPhoneE164,
  guestRequestErrorKey,
  guestResendReadyAt,
  guestResendSecondsLeft,
  guestRsvpCommitFor,
  guestSmsUnavailable,
  guestVerifyErrorKey,
} from "../registration/guestRsvpModel"
import {
  GUEST_OTP_ERROR_FIELD,
  GuestOtpErrorReason,
  type GuestOtpErrorReason as GuestOtpErrorReasonValue,
} from "@civfix/shared"
import {
  appErrorCode,
  appErrorFields,
  EVENT_ENDED_FIELD,
  EVENT_ENDED_REASON,
} from "../../errorCode"

function verifyError(reason: GuestOtpErrorReasonValue): unknown {
  return {
    name: "AppError",
    code: "UNAUTHORIZED",
    message: "Invalid or expired code.",
    fields: { [GUEST_OTP_ERROR_FIELD]: reason },
  }
}

describe("US phone entry", () => {
  it("formats progressively as digits arrive", () => {
    expect(formatGuestPhone("")).toBe("")
    expect(formatGuestPhone("41")).toBe("(41")
    expect(formatGuestPhone("4155")).toBe("(415) 5")
    expect(formatGuestPhone("4155551234")).toBe("(415) 555-1234")
  })

  it("keeps formatting stable when the already-formatted value is re-entered", () => {
    expect(formatGuestPhone("(415) 555-1234")).toBe("(415) 555-1234")
  })

  it("strips a leading country code and caps at ten national digits", () => {
    expect(guestPhoneDigits("+1 (415) 555-1234")).toBe("4155551234")
    expect(guestPhoneDigits("415555123499")).toBe("4155551234")
  })

  it("converts to E.164 only for a number the contract would accept", () => {
    expect(guestPhoneE164("(415) 555-1234")).toBe("+14155551234")
    expect(guestPhoneE164("+1 415 555 1234")).toBe("+14155551234")
  })

  it("rejects an area code the contract's regex forbids", () => {
    expect(guestPhoneE164("(015) 555-1234")).toBeNull()
    expect(guestPhoneE164("(115) 555-1234")).toBeNull()
    expect(guestPhoneE164("415555123")).toBeNull()
  })
})

describe("name and email", () => {
  it("trims a name and rejects blank or over-long ones", () => {
    expect(guestNameValue("  Ada  ")).toBe("Ada")
    expect(guestNameValue("   ")).toBeNull()
    expect(guestNameValue("a".repeat(81))).toBeNull()
  })

  it("lowercases the email the way the contract does and rejects malformed ones", () => {
    expect(guestEmailValue("  Ada@Example.COM ")).toBe("ada@example.com")
    expect(guestEmailValue("ada@example")).toBeNull()
    expect(guestEmailValue("")).toBeNull()
  })
})

describe("submit gating", () => {
  it("builds the channel's own contact field and never the other one", () => {
    expect(guestContactPayload({ ...emptyGuestRsvpForm(), email: "a@b.co" })).toEqual({
      channel: "email",
      email: "a@b.co",
    })
    expect(
      guestContactPayload({
        name: "Ada",
        channel: "sms",
        email: "a@b.co",
        phone: "(415) 555-1234",
      }),
    ).toEqual({ channel: "sms", phone: "+14155551234" })
  })

  it("blocks submit until name and the channel's contact are both valid", () => {
    const form = { name: "Ada", channel: "email" as const, email: "a@b.co", phone: "" }
    expect(canSubmitGuestForm(form, false)).toBe(true)
    expect(canSubmitGuestForm({ ...form, name: " " }, false)).toBe(false)
    expect(canSubmitGuestForm({ ...form, email: "nope" }, false)).toBe(false)
  })

  it("blocks submit while a request is in flight", () => {
    const form = { name: "Ada", channel: "email" as const, email: "a@b.co", phone: "" }
    expect(canSubmitGuestForm(form, true)).toBe(false)
  })
})

describe("error mapping", () => {
  it("maps the request step's codes onto distinct copy", () => {
    expect(guestRequestErrorKey("RATE_LIMITED")).toBe("error.rate_limited")
    expect(guestRequestErrorKey("TURNSTILE_FAILED")).toBe("error.turnstile")
    expect(guestRequestErrorKey("VALIDATION")).toBe("error.invalid_contact")
    expect(guestRequestErrorKey("NOT_FOUND")).toBe("error.event_gone")
    expect(guestRequestErrorKey("CONFLICT")).toBe("error.closed")
    expect(guestRequestErrorKey(undefined)).toBe("error.generic")
  })

  it("reads the verify refusal off the contract's own otp field, not off the status code", () => {
    const invalid = verifyError(GuestOtpErrorReason.invalidCode)
    const exhausted = verifyError(GuestOtpErrorReason.attemptsExhausted)

    expect(guestVerifyErrorKey(appErrorCode(invalid), appErrorFields(invalid))).toBe(
      "error.bad_code",
    )
    expect(guestVerifyErrorKey(appErrorCode(exhausted), appErrorFields(exhausted))).toBe(
      "error.attempts_exhausted",
    )
  })

  it("tells a locked-out guest to wait instead of blaming their code", () => {
    const lockedOut = verifyError(GuestOtpErrorReason.lockedOut)

    expect(guestVerifyErrorKey(appErrorCode(lockedOut), appErrorFields(lockedOut))).toBe(
      "error.rate_limited",
    )
    expect(guestAttemptsExhausted(appErrorFields(lockedOut))).toBe(false)
  })

  it("degrades an un-annotated UNAUTHORIZED to generic, never to a false bad-code claim", () => {
    expect(guestVerifyErrorKey("UNAUTHORIZED", undefined)).toBe("error.generic")
    expect(guestVerifyErrorKey(undefined, undefined)).toBe("error.generic")
    expect(guestVerifyErrorKey("VALIDATION", undefined)).toBe("error.bad_code")
  })

  it("maps the remaining verify codes onto their own copy", () => {
    expect(guestVerifyErrorKey("CONFLICT", undefined)).toBe("error.closed")
    expect(guestVerifyErrorKey("NOT_FOUND", undefined)).toBe("error.event_gone")
    expect(guestVerifyErrorKey("RATE_LIMITED", undefined)).toBe("error.rate_limited")
  })

  it("says the event ENDED when the server names that field, on both guest steps", () => {
    const ended = { [EVENT_ENDED_FIELD]: EVENT_ENDED_REASON }

    expect(guestRequestErrorKey("CONFLICT", ended)).toBe("error.ended")
    expect(guestVerifyErrorKey("CONFLICT", ended)).toBe("error.ended")
    expect(guestRequestErrorKey("CONFLICT", {})).toBe("error.closed")
    expect(guestVerifyErrorKey("CONFLICT", {})).toBe("error.closed")
  })

  it("keeps the ended refusal ahead of the otp reason, so a late code says why it failed", () => {
    const fields = {
      [EVENT_ENDED_FIELD]: EVENT_ENDED_REASON,
      [GUEST_OTP_ERROR_FIELD]: GuestOtpErrorReason.invalidCode,
    }
    expect(guestVerifyErrorKey("CONFLICT", fields)).toBe("error.ended")
  })

  it.each(["en", "es", "de", "ko"])("carries the ended copy in the %s guest catalog", (locale) => {
    const catalog = JSON.parse(
      readFileSync(new URL(`../../../i18n/locales/${locale}/event-guest-rsvp.json`, import.meta.url), "utf8"),
    ) as { error: Record<string, string> }
    expect(catalog.error.ended?.length ?? 0).toBeGreaterThan(0)
    expect(catalog.error.ended).not.toBe(catalog.error.closed)
  })

  it("shows the start-over state ONLY when the server says the attempts are spent", () => {
    expect(guestAttemptsExhausted(appErrorFields(verifyError(GuestOtpErrorReason.attemptsExhausted)))).toBe(
      true,
    )
    expect(guestAttemptsExhausted(appErrorFields(verifyError(GuestOtpErrorReason.invalidCode)))).toBe(
      false,
    )
    expect(guestAttemptsExhausted(undefined)).toBe(false)
    expect(guestAttemptsExhausted({ channel: "sms_unavailable" })).toBe(false)
  })
})

describe("SMS refusal detection", () => {
  it("never flips an EMAIL submit to the unavailable state", () => {
    expect(guestSmsUnavailable("email", { channel: "off" })).toBe(false)
  })

  it("reads a refusal ONLY from the server naming the channel field", () => {
    expect(guestSmsUnavailable("sms", { channel: "sms is disabled" })).toBe(true)
    expect(guestSmsUnavailable("sms", { channel: "cap reached" })).toBe(true)
  })

  it("does NOT read a bare CONFLICT as an SMS refusal - that code means the event is closed", () => {
    expect(guestSmsUnavailable("sms", undefined)).toBe(false)
    expect(guestRequestErrorKey("CONFLICT")).toBe("error.closed")
  })

  it("leaves a plain bad-number validation as an ordinary error", () => {
    expect(guestSmsUnavailable("sms", { phone: "invalid" })).toBe(false)
    expect(guestSmsUnavailable("sms", undefined)).toBe(false)
  })
})

describe("resend cooldown", () => {
  it("counts down from the server's resendAfterSec and floors at zero", () => {
    const readyAt = guestResendReadyAt(1_000_000, 30)
    expect(guestResendSecondsLeft(readyAt, 1_000_000)).toBe(30)
    expect(guestResendSecondsLeft(readyAt, 1_015_000)).toBe(15)
    expect(guestResendSecondsLeft(readyAt, 1_030_000)).toBe(0)
    expect(guestResendSecondsLeft(readyAt, 9_999_999)).toBe(0)
  })

  it("is zero before any code has been sent", () => {
    expect(guestResendSecondsLeft(null, 1_000_000)).toBe(0)
  })

  it("treats a negative cooldown as immediately resendable", () => {
    expect(guestResendSecondsLeft(guestResendReadyAt(1_000, -5), 1_000)).toBe(0)
  })
})

describe("the web Cmd/Ctrl+Enter commit per step", () => {
  it("does nothing on the choice step, which has two equal answers and no default", () => {
    expect(guestRsvpCommitFor("choice", false)).toBeNull()
    expect(guestRsvpCommitFor("choice", true)).toBeNull()
  })

  it("submits the form, verifies the code, starts over once attempts run out, and closes on success", () => {
    expect(guestRsvpCommitFor("form", false)).toBe("submitForm")
    expect(guestRsvpCommitFor("code", false)).toBe("submitCode")
    expect(guestRsvpCommitFor("code", true)).toBe("startOver")
    expect(guestRsvpCommitFor("success", false)).toBe("close")
  })

  it("is what the sheet hands ModalCardSheet as onCommit", () => {
    const sheet = readFileSync(new URL("../registration/GuestRsvpSheet.tsx", import.meta.url), "utf8")
    expect(sheet).toContain("guestRsvpCommitFor(step, exhausted)")
    expect(sheet).not.toMatch(/\(exhausted \? startOver : submitCode\) : onClose/)
  })
})
