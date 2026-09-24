import {
  GUEST_OTP_ERROR_FIELD,
  GUEST_RSVP_TURNSTILE_ACTION,
  GuestOtpErrorReason,
  MAX_GUEST_NAME,
  type EventQuestionDTO,
  type GuestContactChannel,
  type TicketTypeDTO,
} from "@civfix/shared"
import { isEventEndedRefusal } from "../../errorCode"
import { initialAnswers, type AnswerMap } from "./questionModel"
import { defaultTicketTypeId } from "./registrationModel"

export type GuestRsvpStep = "choice" | "form" | "code" | "success"

export type GuestRsvpCommit = "submitForm" | "submitCode" | "startOver" | "close"

export function guestRsvpCommit(step: GuestRsvpStep, exhausted: boolean): GuestRsvpCommit {
  switch (step) {
    case "form":
      return "submitForm"
    case "code":
      return exhausted ? "startOver" : "submitCode"
    case "choice":
    case "success":
      return "close"
  }
}

export const GUEST_RSVP_CODE_LENGTH = 6

export { GUEST_RSVP_TURNSTILE_ACTION }

const US_PHONE_E164 = /^\+1[2-9]\d{9}$/

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const GUEST_EMAIL_MAX = 254

export interface GuestRsvpFormState {
  name: string
  channel: GuestContactChannel
  email: string
  phone: string
}

export type GuestContactPayload =
  | { channel: "email"; email: string }
  | { channel: "sms"; phone: string }

export function emptyGuestRsvpForm(channel: GuestContactChannel = "email"): GuestRsvpFormState {
  return { name: "", channel, email: "", phone: "" }
}

export function guestPhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  return national.slice(0, 10)
}

export function formatGuestPhone(raw: string): string {
  const d = guestPhoneDigits(raw)
  if (d.length === 0) return ""
  if (d.length <= 3) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

export function guestPhoneE164(raw: string): string | null {
  const value = `+1${guestPhoneDigits(raw)}`
  return US_PHONE_E164.test(value) ? value : null
}

export function guestEmailValue(raw: string): string | null {
  const value = raw.trim().toLowerCase()
  if (value.length === 0 || value.length > GUEST_EMAIL_MAX) return null
  return EMAIL_SHAPE.test(value) ? value : null
}

export function guestNameValue(raw: string): string | null {
  const value = raw.trim()
  if (value.length === 0 || value.length > MAX_GUEST_NAME) return null
  return value
}

export function guestContactPayload(form: GuestRsvpFormState): GuestContactPayload | null {
  if (form.channel === "email") {
    const email = guestEmailValue(form.email)
    return email === null ? null : { channel: "email", email }
  }
  const phone = guestPhoneE164(form.phone)
  return phone === null ? null : { channel: "sms", phone }
}

export function canSubmitGuestForm(form: GuestRsvpFormState, pending: boolean): boolean {
  if (pending) return false
  return guestNameValue(form.name) !== null && guestContactPayload(form) !== null
}

export function guestRequestErrorKey(
  code: string | undefined,
  fields?: Record<string, string> | undefined,
): string {
  if (isEventEndedRefusal(fields)) return "error.ended"
  if (code === "RATE_LIMITED") return "error.rate_limited"
  if (code === "TURNSTILE_FAILED") return "error.turnstile"
  if (code === "VALIDATION") return "error.invalid_contact"
  if (code === "NOT_FOUND") return "error.event_gone"
  if (code === "CONFLICT") return "error.closed"
  return "error.generic"
}

function guestOtpErrorReason(fields: Record<string, string> | undefined): string | undefined {
  return fields?.[GUEST_OTP_ERROR_FIELD]
}

function namesChannel(fields: Record<string, string> | undefined): boolean {
  return fields !== undefined && Object.prototype.hasOwnProperty.call(fields, "channel")
}

export function guestVerifyErrorKey(
  code: string | undefined,
  fields: Record<string, string> | undefined,
): string {
  if (isEventEndedRefusal(fields)) return "error.ended"
  const reason = guestOtpErrorReason(fields)
  if (reason === GuestOtpErrorReason.attemptsExhausted) return "error.attempts_exhausted"
  if (reason === GuestOtpErrorReason.invalidCode) return "error.bad_code"
  if (reason === GuestOtpErrorReason.lockedOut) return "error.rate_limited"
  if (code === "VALIDATION") return "error.bad_code"
  if (code === "NOT_FOUND") return "error.event_gone"
  if (code === "RATE_LIMITED") return "error.rate_limited"
  if (code === "CONFLICT") return "error.closed"
  return "error.generic"
}

export function guestAttemptsExhausted(fields: Record<string, string> | undefined): boolean {
  return guestOtpErrorReason(fields) === GuestOtpErrorReason.attemptsExhausted
}

export function guestSmsUnavailable(
  channel: GuestContactChannel,
  fields: Record<string, string> | undefined,
): boolean {
  if (channel !== "sms") return false
  return namesChannel(fields)
}

export const RESEND_COUNTDOWN_TICK_MS = 1000

export function guestResendReadyAt(nowMs: number, resendAfterSec: number): number {
  return nowMs + Math.max(0, resendAfterSec) * 1000
}

export function guestResendSecondsLeft(readyAtMs: number | null, nowMs: number): number {
  if (readyAtMs === null) return 0
  return Math.max(0, Math.ceil((readyAtMs - nowMs) / 1000))
}

/**
 * The ticket type the sheet registers for: the viewer's pick while it is still offered, else the
 * default. Deriving it (instead of seeding state once on open) covers ticket types that load after the
 * sheet opened or drop the picked type on a refetch, so a registration never goes out without one.
 */
export function effectiveTicketTypeId(types: readonly TicketTypeDTO[], chosen: string | null): string | null {
  if (chosen !== null && types.some((type) => type.id === chosen)) return chosen
  return defaultTicketTypeId(types)
}

/** What the viewer answered, over every question's default (questions may arrive after the sheet opened). */
export function answersWithDefaults(questions: readonly EventQuestionDTO[], typed: AnswerMap): AnswerMap {
  return { ...initialAnswers(questions), ...typed }
}
