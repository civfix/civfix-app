import * as React from "react"
import {
  ErrorCode,
  GUEST_RSVP_TURNSTILE_ACTION,
  type EventAnswerValue,
  type LegalDocumentType,
  type LegalVersionOutdatedDetails,
  type PublicEventPageDTO,
  toAppError,
} from "@civfix/contract"
import {
  answerPayload,
  clampPartySize,
  defaultTicketTypeId,
  missingRequired,
  visibleQuestions as shownQuestions,
} from "@civfix/contract/host"
import { outdatedLegalVersions, useLegalDocuments } from "@civfix/ui/data"

import { api } from "@/lib/api"
import { TURNSTILE_SITEKEY, runTurnstile } from "@/lib/turnstile"
import { useAuthStore } from "@/store/auth-store"
import {
  isSuccessOutcome,
  outcomeMessageKey,
  registrationWindowState,
  selectableTickets,
  ticketById,
  waitlistAvailable,
} from "./registration-state"

const REGISTRATION_CONSENT_SURFACE = "web_register" as const

const GUEST_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// The step and the in-flight flag are separate on purpose: while a guest code is being verified the
// code step must stay on screen (disabled), not collapse back into the registration form.
type Step =
  | { readonly kind: "form" }
  | { readonly kind: "code" }
  | { readonly kind: "registered"; readonly messageKey: string }
  | { readonly kind: "waitlisted" }

export function useRegistrationFlow(page: PublicEventPageDTO, initialAccessCode: string | null) {
  const isAuthenticated = useAuthStore((store) => store.status === "authenticated")
  const windowState = React.useMemo(
    () => registrationWindowState(page, Date.now()),
    [page],
  )

  const tickets = selectableTickets(page)
  const [ticketTypeId, setTicketTypeId] = React.useState<string | null>(() =>
    defaultTicketTypeId(selectableTickets(page)),
  )
  // Raw text so the field can be cleared and retyped; it is clamped on blur and on submit.
  const [partyInput, setPartyInput] = React.useState("1")
  const [answers, setAnswers] = React.useState<Record<string, EventAnswerValue>>({})
  const [accessCode, setAccessCode] = React.useState(initialAccessCode ?? "")
  const [hostContactOptIn, setHostContactOptIn] = React.useState(false)
  const [termsAccepted, setTermsAccepted] = React.useState(false)
  const [guestName, setGuestName] = React.useState("")
  const [guestEmail, setGuestEmail] = React.useState("")
  const [otp, setOtp] = React.useState("")
  const [step, setStep] = React.useState<Step>({ kind: "form" })
  const [busy, setBusy] = React.useState(false)
  // A second tap can land before the re-render that disables the button; the ref closes that gap so
  // one attempt never sends two requests.
  const inFlight = React.useRef(false)
  const [resendAfter, setResendAfter] = React.useState(0)
  const [errorKey, setErrorKey] = React.useState<string | null>(null)
  const [showErrors, setShowErrors] = React.useState(false)
  const idempotencyKey = React.useRef(newIdempotencyKey())
  const legal = useLegalDocuments()
  // Versions an outdated answer named. They win for as long as the form is mounted and stay out of the
  // query cache, since they carry no document text.
  const [outdatedCurrent, setOutdatedCurrent] = React.useState<LegalVersionOutdatedDetails["current"] | null>(
    null,
  )

  React.useEffect(() => {
    if (resendAfter <= 0) return
    const timer = setInterval(() => setResendAfter((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendAfter])

  const ticket = ticketById(page, ticketTypeId)
  const visibleQuestions = shownQuestions(page.questions, ticketTypeId, answers)
  const missing = missingRequired(visibleQuestions, answers)
  const needsAccessCode = ticket?.requiresAccessCode === true
  const maxParty = ticket?.maxPartySize ?? 1
  const partySize = clampPartySize(Number(partyInput), maxParty)

  const soldOut = windowState === "sold_out"
  const waitlistOffered = soldOut && waitlistAvailable(ticket, page)
  const canWaitlist = waitlistOffered && isAuthenticated
  const guestWaitlistBlocked = waitlistOffered && !isAuthenticated

  const legalVersion = (type: LegalDocumentType) =>
    (outdatedCurrent?.find((entry) => entry.type === type) ?? legal.data?.find((entry) => entry.type === type))
      ?.version
  const termsVersion = legalVersion("terms")
  const privacyVersion = legalVersion("privacy")
  const legalReady = termsVersion !== undefined && privacyVersion !== undefined
  const legalFailed = !legalReady && !legal.isPending && !legal.isFetching
  const retryLegal = () => {
    void legal.refetch()
  }

  const begin = (): boolean => {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true)
    return true
  }
  const finish = () => {
    inFlight.current = false
    setBusy(false)
  }

  // Every submit path sends the same selection, in the same key order.
  const registrationBase = (terms: string, privacy: string) => ({
    ...(ticketTypeId ? { ticketTypeId } : {}),
    partySize,
    ...(needsAccessCode ? { accessCode: accessCode.trim() } : {}),
    answers: answerPayload(visibleQuestions, answers),
    consent: {
      termsVersion: terms,
      disclosureVersion: privacy,
      hostContactOptIn,
      surface: REGISTRATION_CONSENT_SURFACE,
    },
  })

  // The terms changed under the visitor: the form shows again with every box unticked.
  const adoptOutdated = (cause: unknown): boolean => {
    const current = outdatedLegalVersions(cause)
    if (current === null) return false
    setOutdatedCurrent(current)
    setTermsAccepted(false)
    setHostContactOptIn(false)
    setOtp("")
    setStep({ kind: "form" })
    setErrorKey("host-ticket:consent.outdated")
    return true
  }

  const validate = (): boolean => {
    setShowErrors(true)
    if (missing.length > 0) {
      setErrorKey("errors.required")
      return false
    }
    if (needsAccessCode && accessCode.trim().length === 0) {
      setErrorKey("errors.access_code")
      return false
    }
    if (!termsAccepted) {
      setErrorKey("errors.terms")
      return false
    }
    if (!isAuthenticated) {
      if (guestName.trim().length === 0) {
        setErrorKey("errors.name")
        return false
      }
      if (!GUEST_EMAIL_PATTERN.test(guestEmail.trim())) {
        setErrorKey("errors.email")
        return false
      }
    }
    setErrorKey(null)
    return true
  }

  const registerAsMember = async () => {
    if (termsVersion === undefined || privacyVersion === undefined) return
    if (inFlight.current || !validate() || !begin()) return
    try {
      const response = await api.registerForEvent({
        id: page.event.id,
        idempotencyKey: idempotencyKey.current,
        ...registrationBase(termsVersion, privacyVersion),
        joinWaitlistIfFull: waitlistOffered,
      })
      if (response.outcome === "waitlisted") {
        setStep({ kind: "waitlisted" })
        return
      }
      if (isSuccessOutcome(response.outcome)) {
        setStep({ kind: "registered", messageKey: outcomeMessageKey(response.outcome) })
        return
      }
      setErrorKey(outcomeMessageKey(response.outcome))
      idempotencyKey.current = newIdempotencyKey()
    } catch (cause) {
      if (!adoptOutdated(cause)) setErrorKey(requestErrorKey(cause))
      idempotencyKey.current = newIdempotencyKey()
    } finally {
      finish()
    }
  }

  const requestGuestCode = async () => {
    if (termsVersion === undefined || privacyVersion === undefined) return
    if (inFlight.current || !validate()) return
    if (!TURNSTILE_SITEKEY) {
      setErrorKey("errors.guest_unavailable")
      return
    }
    if (!begin()) return
    try {
      const turnstileToken = await runTurnstile(GUEST_RSVP_TURNSTILE_ACTION)
      if (turnstileToken.length === 0) {
        setErrorKey("errors.bot")
        return
      }
      const response = await api.guestRsvpRequest({
        id: page.event.id,
        name: guestName.trim(),
        channel: "email",
        email: guestEmail.trim(),
        ...registrationBase(termsVersion, privacyVersion),
        turnstileToken,
        website: "",
      })
      setResendAfter(response.resendAfterSec)
      setOtp("")
      setStep({ kind: "code" })
      setErrorKey(null)
    } catch (cause) {
      if (!adoptOutdated(cause)) setErrorKey(requestErrorKey(cause))
    } finally {
      finish()
    }
  }

  const verifyGuestCode = async () => {
    if (termsVersion === undefined || privacyVersion === undefined || !begin()) return
    try {
      await api.guestRsvpVerify({
        id: page.event.id,
        channel: "email",
        email: guestEmail.trim(),
        ...registrationBase(termsVersion, privacyVersion),
        code: otp.trim(),
      })
      setStep({ kind: "registered", messageKey: "web-signup:outcome.registered" })
      setErrorKey(null)
    } catch (cause) {
      if (!adoptOutdated(cause)) setErrorKey(requestErrorKey(cause))
    } finally {
      finish()
    }
  }

  const joinWaitlist = async () => {
    if (ticketTypeId === null || !begin()) return
    try {
      await api.joinEventWaitlist({
        id: page.event.id,
        ticketTypeId,
        partySize,
      })
      setStep({ kind: "waitlisted" })
    } catch (cause) {
      setErrorKey(requestErrorKey(cause))
    } finally {
      finish()
    }
  }

  const backToForm = () => {
    setErrorKey(null)
    setOtp("")
    setStep({ kind: "form" })
  }

  const chooseTicket = (id: string) => {
    setTicketTypeId(id)
    setPartyInput("1")
  }

  const setAnswer = (questionId: string, next: EventAnswerValue) =>
    setAnswers((current) => ({ ...current, [questionId]: next }))

  return {
    isAuthenticated,
    windowState,
    tickets,
    ticketTypeId,
    visibleQuestions,
    missing,
    needsAccessCode,
    maxParty,
    partySize,
    soldOut,
    waitlistOffered,
    canWaitlist,
    guestWaitlistBlocked,
    partyInput,
    setPartyInput,
    answers,
    setAnswer,
    accessCode,
    setAccessCode,
    hostContactOptIn,
    setHostContactOptIn,
    termsAccepted,
    setTermsAccepted,
    guestName,
    setGuestName,
    guestEmail,
    setGuestEmail,
    otp,
    setOtp,
    step,
    busy,
    legalReady,
    legalFailed,
    retryLegal,
    resendAfter,
    errorKey,
    showErrors,
    registerAsMember,
    requestGuestCode,
    verifyGuestCode,
    joinWaitlist,
    backToForm,
    chooseTicket,
  }
}

export type RegistrationFlow = ReturnType<typeof useRegistrationFlow>

function newIdempotencyKey(): string {
  const random = globalThis.crypto?.randomUUID?.()
  return random ?? `signup-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}

function requestErrorKey(cause: unknown): string {
  switch (toAppError(cause).code) {
    case ErrorCode.RATE_LIMITED:
      return "errors.rate_limited"
    case ErrorCode.VALIDATION:
      return "errors.validation"
    case ErrorCode.CONFLICT:
      return "errors.conflict"
    case ErrorCode.TURNSTILE_FAILED:
      return "errors.bot"
    case ErrorCode.NOT_FOUND:
      return "errors.not_found"
    default:
      return "errors.generic"
  }
}
