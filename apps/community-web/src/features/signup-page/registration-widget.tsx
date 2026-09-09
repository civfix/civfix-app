"use client"

import * as React from "react"
import { CircleAlert, Loader2 } from "lucide-react"
import {
  ErrorCode,
  GUEST_RSVP_TURNSTILE_ACTION,
  currentVersion,
  type EventQuestionDTO,
  type PublicEventPageDTO,
} from "@civfix/shared"

import { api, toAppError } from "@/lib/api"
import { TURNSTILE_SITEKEY, runTurnstile } from "@/lib/turnstile"
import { useAuthStore } from "@/store/auth-store"
import {
  answerPayload,
  clampPartySize,
  defaultTicketId,
  isSuccessOutcome,
  missingRequired,
  outcomeMessage,
  questionVisible,
  questionsFor,
  registrationWindowState,
  selectableTickets,
  ticketById,
  waitlistAvailable,
  type AnswerValue,
} from "./registration-state"

export const REGISTRATION_CONSENT_SURFACE = "web_register" as const

type Phase =
  | { readonly kind: "form" }
  | { readonly kind: "submitting" }
  | { readonly kind: "guest_code"; readonly resendAfterSec: number }
  | { readonly kind: "registered"; readonly message: string }
  | { readonly kind: "waitlisted" }

interface RegistrationWidgetProps {
  page: PublicEventPageDTO
  initialAccessCode: string | null
}

export function RegistrationWidget({ page, initialAccessCode }: RegistrationWidgetProps) {
  const isAuthenticated = useAuthStore((store) => store.status === "authenticated")
  const windowState = React.useMemo(
    () => registrationWindowState(page, Date.now()),
    [page],
  )

  const tickets = selectableTickets(page)
  const [ticketTypeId, setTicketTypeId] = React.useState<string | null>(() => defaultTicketId(page))
  const [partySize, setPartySize] = React.useState(1)
  const [answers, setAnswers] = React.useState<Record<string, AnswerValue>>({})
  const [accessCode, setAccessCode] = React.useState(initialAccessCode ?? "")
  const [hostContactOptIn, setHostContactOptIn] = React.useState(false)
  const [termsAccepted, setTermsAccepted] = React.useState(false)
  const [guestName, setGuestName] = React.useState("")
  const [guestEmail, setGuestEmail] = React.useState("")
  const [otp, setOtp] = React.useState("")
  const [phase, setPhase] = React.useState<Phase>({ kind: "form" })
  const [error, setError] = React.useState<string | null>(null)
  const [showErrors, setShowErrors] = React.useState(false)
  const idempotencyKey = React.useRef(newIdempotencyKey())

  const ticket = ticketById(page, ticketTypeId)
  const scopedQuestions = questionsFor(page.questions, ticketTypeId)
  const visibleQuestions = scopedQuestions.filter((question) => questionVisible(question, answers))
  const missing = missingRequired(page.questions, answers, ticketTypeId)
  const needsAccessCode = ticket?.requiresAccessCode === true
  const maxParty = ticket?.maxPartySize ?? 1

  if (windowState === "cancelled") {
    return <WidgetNotice tone="alert" title="This event was cancelled" />
  }
  if (windowState === "closed") {
    return <WidgetNotice tone="muted" title="Registration is closed" />
  }
  if (windowState === "not_yet_open") {
    return (
      <WidgetNotice tone="muted" title="Registration hasn&rsquo;t opened yet">
        Check back closer to the event.
      </WidgetNotice>
    )
  }

  if (phase.kind === "registered") {
    return <WidgetNotice tone="success" title={phase.message} />
  }
  if (phase.kind === "waitlisted") {
    return (
      <WidgetNotice tone="success" title="You're on the waitlist">
        We&rsquo;ll email you if a spot opens up.
      </WidgetNotice>
    )
  }

  const soldOut = windowState === "sold_out"
  const waitlistOffered = soldOut && waitlistAvailable(ticket, page)
  const canWaitlist = waitlistOffered && isAuthenticated
  const guestWaitlistBlocked = waitlistOffered && !isAuthenticated
  const busy = phase.kind === "submitting"

  const consentPayload = () => ({
    termsVersion: currentVersion("terms"),
    disclosureVersion: page.consentVersions.disclosureVersion,
    hostContactOptIn,
    surface: REGISTRATION_CONSENT_SURFACE,
  })

  const validate = (): boolean => {
    setShowErrors(true)
    if (missing.length > 0) {
      setError("Please answer the required questions.")
      return false
    }
    if (needsAccessCode && accessCode.trim().length === 0) {
      setError("Enter the access code for this ticket.")
      return false
    }
    if (!termsAccepted) {
      setError("Please accept the terms to register.")
      return false
    }
    if (!isAuthenticated) {
      if (guestName.trim().length === 0) {
        setError("Enter your name.")
        return false
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        setError("Enter an email address so the host can reach you.")
        return false
      }
    }
    setError(null)
    return true
  }

  const registerAsMember = async () => {
    if (!validate() || busy) return
    setPhase({ kind: "submitting" })
    try {
      const response = await api.registerForEvent({
        id: page.event.id,
        idempotencyKey: idempotencyKey.current,
        ...(ticketTypeId ? { ticketTypeId } : {}),
        partySize: clampPartySize(partySize, maxParty),
        ...(needsAccessCode ? { accessCode: accessCode.trim() } : {}),
        answers: answerPayload(page.questions, answers, ticketTypeId),
        consent: consentPayload(),
        joinWaitlistIfFull: waitlistOffered,
      })
      if (response.outcome === "waitlisted") {
        setPhase({ kind: "waitlisted" })
        return
      }
      if (isSuccessOutcome(response.outcome)) {
        setPhase({ kind: "registered", message: outcomeMessage(response.outcome) })
        return
      }
      setPhase({ kind: "form" })
      setError(outcomeMessage(response.outcome))
      idempotencyKey.current = newIdempotencyKey()
    } catch (cause) {
      setPhase({ kind: "form" })
      setError(requestErrorMessage(cause))
      idempotencyKey.current = newIdempotencyKey()
    }
  }

  const requestGuestCode = async () => {
    if (!validate() || busy) return
    if (!TURNSTILE_SITEKEY) {
      setError(
        "Signing up without a civfix account isn't available right now. Sign in to register instead.",
      )
      return
    }
    setPhase({ kind: "submitting" })
    try {
      const turnstileToken = await runTurnstile(GUEST_RSVP_TURNSTILE_ACTION)
      if (turnstileToken.length === 0) {
        setPhase({ kind: "form" })
        setError("We couldn't confirm you're not a bot. Reload the page and try again.")
        return
      }
      const response = await api.guestRsvpRequest({
        id: page.event.id,
        name: guestName.trim(),
        channel: "email",
        email: guestEmail.trim(),
        ...(ticketTypeId ? { ticketTypeId } : {}),
        partySize: clampPartySize(partySize, maxParty),
        ...(needsAccessCode ? { accessCode: accessCode.trim() } : {}),
        answers: answerPayload(page.questions, answers, ticketTypeId),
        consent: consentPayload(),
        turnstileToken,
        website: "",
      })
      setPhase({ kind: "guest_code", resendAfterSec: response.resendAfterSec })
      setError(null)
    } catch (cause) {
      setPhase({ kind: "form" })
      setError(requestErrorMessage(cause))
    }
  }

  const verifyGuestCode = async () => {
    if (busy) return
    setPhase({ kind: "submitting" })
    try {
      await api.guestRsvpVerify({
        id: page.event.id,
        channel: "email",
        email: guestEmail.trim(),
        ...(ticketTypeId ? { ticketTypeId } : {}),
        partySize: clampPartySize(partySize, maxParty),
        ...(needsAccessCode ? { accessCode: accessCode.trim() } : {}),
        answers: answerPayload(page.questions, answers, ticketTypeId),
        consent: consentPayload(),
        code: otp.trim(),
      })
      setPhase({ kind: "registered", message: "You're registered." })
      setError(null)
    } catch (cause) {
      setPhase({ kind: "guest_code", resendAfterSec: 0 })
      setError(requestErrorMessage(cause))
    }
  }

  const joinWaitlist = async () => {
    if (ticketTypeId === null || busy) return
    setPhase({ kind: "submitting" })
    try {
      await api.joinEventWaitlist({
        id: page.event.id,
        ticketTypeId,
        partySize: clampPartySize(partySize, maxParty),
      })
      setPhase({ kind: "waitlisted" })
    } catch (cause) {
      setPhase({ kind: "form" })
      setError(requestErrorMessage(cause))
    }
  }

  if (phase.kind === "guest_code") {
    return (
      <section className="signup-widget" aria-labelledby="signup-widget-heading">
        <h2 id="signup-widget-heading">Check your email</h2>
        <p className="signup-hint">
          We sent a code to {guestEmail.trim()}. Enter it to finish registering.
        </p>
        <div className="signup-field">
          <label htmlFor="signup-otp">Confirmation code</label>
          <input
            id="signup-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(cause) => setOtp(cause.target.value)}
          />
        </div>
        {error ? (
          <p className="signup-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="signup-submit"
          disabled={otp.trim().length === 0}
          onClick={() => {
            void verifyGuestCode()
          }}
        >
          Finish registering
        </button>
      </section>
    )
  }

  return (
    <section className="signup-widget" aria-labelledby="signup-widget-heading">
      <h2 id="signup-widget-heading">{soldOut ? "This event is full" : "Register"}</h2>

      {soldOut ? (
        <p className="signup-hint">
          {!waitlistOffered
            ? "There are no spots left."
            : guestWaitlistBlocked
              ? "There are no spots left. Sign in to a civfix account to join the waitlist \u2014 we need somewhere to reach you when one opens up."
              : "Join the waitlist and we\u2019ll let you know if a spot opens up."}
        </p>
      ) : null}

      {tickets.length > 1 ? (
        <fieldset className="signup-tickets">
          <legend>Ticket</legend>
          {tickets.map((option) => (
            <label key={option.id} className="signup-ticket" data-sold-out={String(option.soldOut)}>
              <input
                type="radio"
                name="signup-ticket"
                value={option.id}
                checked={ticketTypeId === option.id}
                disabled={busy}
                onChange={() => {
                  setTicketTypeId(option.id)
                  setPartySize(1)
                }}
              />
              <span>
                <strong>{option.name}</strong>
                {option.soldOut ? " · Sold out" : ""}
                {option.description ? <em>{option.description}</em> : null}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {maxParty > 1 ? (
        <div className="signup-field">
          <label htmlFor="signup-party">How many people, including you?</label>
          <input
            id="signup-party"
            type="number"
            min={1}
            max={maxParty}
            value={partySize}
            disabled={busy}
            onChange={(cause) => setPartySize(clampPartySize(Number(cause.target.value), maxParty))}
          />
        </div>
      ) : null}

      {needsAccessCode ? (
        <div className="signup-field">
          <label htmlFor="signup-access-code">Access code</label>
          <input
            id="signup-access-code"
            value={accessCode}
            disabled={busy}
            onChange={(cause) => setAccessCode(cause.target.value)}
          />
        </div>
      ) : null}

      {isAuthenticated ? null : (
        <>
          <div className="signup-field">
            <label htmlFor="signup-name">Your name</label>
            <input
              id="signup-name"
              autoComplete="name"
              value={guestName}
              disabled={busy}
              onChange={(cause) => setGuestName(cause.target.value)}
            />
          </div>
          <div className="signup-field">
            <label htmlFor="signup-email">Email address</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={guestEmail}
              disabled={busy}
              onChange={(cause) => setGuestEmail(cause.target.value)}
            />
            <p className="signup-hint">
              The host uses this to send you event updates. It is not shown publicly.
            </p>
          </div>
        </>
      )}

      {visibleQuestions.map((question) => (
        <QuestionField
          key={question.id}
          question={question}
          value={answers[question.id]}
          invalid={showErrors && missing.includes(question.id)}
          disabled={busy}
          onChange={(next) => setAnswers((current) => ({ ...current, [question.id]: next }))}
        />
      ))}

      <div className="signup-check">
        <input
          id="signup-host-contact"
          type="checkbox"
          checked={hostContactOptIn}
          disabled={busy}
          onChange={(cause) => setHostContactOptIn(cause.target.checked)}
        />
        <label htmlFor="signup-host-contact">
          The host may contact me about future events, not just this one.
        </label>
      </div>

      <div className="signup-check">
        <input
          id="signup-terms"
          type="checkbox"
          checked={termsAccepted}
          disabled={busy}
          aria-invalid={showErrors && !termsAccepted ? true : undefined}
          onChange={(cause) => setTermsAccepted(cause.target.checked)}
        />
        <label htmlFor="signup-terms">
          I agree to the{" "}
          <a href="/legal/terms" rel="noreferrer noopener" target="_blank">
            Terms of Service
          </a>{" "}
          and the{" "}
          <a href="/legal/privacy" rel="noreferrer noopener" target="_blank">
            Privacy Policy
          </a>
          , and I understand the host will see my name and my answers.
        </label>
      </div>

      {error ? (
        <p className="signup-error" role="alert">
          <CircleAlert aria-hidden="true" size={16} /> {error}
        </p>
      ) : null}

      {canWaitlist ? (
        <button
          type="button"
          className="signup-submit"
          disabled={busy}
          onClick={() => {
            void joinWaitlist()
          }}
        >
          {busy ? <Loader2 aria-hidden="true" className="signup-spin" size={16} /> : null} Join the
          waitlist
        </button>
      ) : (
        <button
          type="button"
          className="signup-submit"
          disabled={busy || soldOut}
          onClick={() => {
            void (isAuthenticated ? registerAsMember() : requestGuestCode())
          }}
        >
          {busy ? <Loader2 aria-hidden="true" className="signup-spin" size={16} /> : null}{" "}
          {soldOut ? "Sold out" : isAuthenticated ? "Count me in" : "Register"}
        </button>
      )}

      {isAuthenticated || TURNSTILE_SITEKEY ? null : (
        <p className="signup-hint">
          Signing up without a civfix account isn&rsquo;t available on this build. Sign in to register.
        </p>
      )}
    </section>
  )
}

interface QuestionFieldProps {
  question: EventQuestionDTO
  value: AnswerValue | undefined
  invalid: boolean
  disabled: boolean
  onChange: (next: AnswerValue) => void
}

function QuestionField({ question, value, invalid, disabled, onChange }: QuestionFieldProps) {
  const id = `signup-question-${question.id}`
  const help = question.helpText ? `${id}-help` : undefined

  if (question.kind === "checkbox" || question.kind === "consent") {
    return (
      <div className="signup-check">
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          aria-invalid={invalid ? true : undefined}
          onChange={(cause) => onChange(cause.target.checked)}
        />
        <label htmlFor={id}>{question.consentText ?? question.prompt}</label>
      </div>
    )
  }

  if (question.kind === "single_select") {
    return (
      <fieldset className="signup-field">
        <legend>
          {question.prompt}
          {question.required ? " *" : ""}
        </legend>
        {question.helpText ? (
          <p className="signup-hint" id={help}>
            {question.helpText}
          </p>
        ) : null}
        {question.options.map((option) => (
          <label key={option.value} className="signup-check">
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    )
  }

  if (question.kind === "multi_select") {
    const selected = Array.isArray(value) ? value : []
    return (
      <fieldset className="signup-field">
        <legend>
          {question.prompt}
          {question.required ? " *" : ""}
        </legend>
        {question.options.map((option) => (
          <label key={option.value} className="signup-check">
            <input
              type="checkbox"
              value={option.value}
              checked={selected.includes(option.value)}
              disabled={disabled}
              onChange={(cause) =>
                onChange(
                  cause.target.checked
                    ? [...selected, option.value]
                    : selected.filter((entry) => entry !== option.value),
                )
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    )
  }

  return (
    <div className="signup-field">
      <label htmlFor={id}>
        {question.prompt}
        {question.required ? " *" : ""}
      </label>
      {question.helpText ? (
        <p className="signup-hint" id={help}>
          {question.helpText}
        </p>
      ) : null}
      {question.kind === "long_text" ? (
        <textarea
          id={id}
          rows={4}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          aria-describedby={help}
          aria-invalid={invalid ? true : undefined}
          onChange={(cause) => onChange(cause.target.value)}
        />
      ) : (
        <input
          id={id}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          aria-describedby={help}
          aria-invalid={invalid ? true : undefined}
          onChange={(cause) => onChange(cause.target.value)}
        />
      )}
    </div>
  )
}

interface WidgetNoticeProps {
  tone: "success" | "muted" | "alert"
  title: string
  children?: React.ReactNode
}

function WidgetNotice({ tone, title, children }: WidgetNoticeProps) {
  return (
    <section className="signup-widget signup-widget-notice" data-tone={tone} role="status">
      <h2>{title}</h2>
      {children ? <p className="signup-hint">{children}</p> : null}
    </section>
  )
}

function newIdempotencyKey(): string {
  const random = globalThis.crypto?.randomUUID?.()
  return random ?? `signup-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}

function requestErrorMessage(cause: unknown): string {
  const error = toAppError(cause)
  switch (error.code) {
    case ErrorCode.RATE_LIMITED:
      return "Too many attempts. Wait a minute and try again."
    case ErrorCode.VALIDATION:
      return "Please check the details above and try again."
    case ErrorCode.CONFLICT:
      return "Something changed while you were filling this in. Reload the page."
    case ErrorCode.TURNSTILE_FAILED:
      return "We couldn't confirm you're not a bot. Reload the page and try again."
    case ErrorCode.NOT_FOUND:
      return "This event is no longer available."
    default:
      return "We couldn't complete that. Please try again."
  }
}
