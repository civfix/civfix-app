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

import { Trans, useT } from "@civfix/ui/i18n"

import { api, toAppError } from "@/lib/api"
import { TURNSTILE_SITEKEY, runTurnstile } from "@/lib/turnstile"
import { useAuthStore } from "@/store/auth-store"
import {
  answerPayload,
  clampPartySize,
  defaultTicketId,
  isSuccessOutcome,
  missingRequired,
  outcomeMessageKey,
  questionVisible,
  questionsFor,
  registrationWindowState,
  selectableTickets,
  ticketById,
  waitlistAvailable,
  type AnswerValue,
} from "./registration-state"

export const REGISTRATION_CONSENT_SURFACE = "web_register" as const

const ERROR_ID = "signup-widget-error"

// The step and the in-flight flag are separate on purpose: while a guest code is being verified the
// code step must stay on screen (disabled), not collapse back into the registration form.
type Step =
  | { readonly kind: "form" }
  | { readonly kind: "code" }
  | { readonly kind: "registered"; readonly messageKey: string }
  | { readonly kind: "waitlisted" }

interface RegistrationWidgetProps {
  page: PublicEventPageDTO
  initialAccessCode: string | null
}

export function RegistrationWidget({ page, initialAccessCode }: RegistrationWidgetProps) {
  const { t } = useT("web-signup")
  const isAuthenticated = useAuthStore((store) => store.status === "authenticated")
  const windowState = React.useMemo(
    () => registrationWindowState(page, Date.now()),
    [page],
  )

  const tickets = selectableTickets(page)
  const [ticketTypeId, setTicketTypeId] = React.useState<string | null>(() => defaultTicketId(page))
  // Raw text so the field can be cleared and retyped; it is clamped on blur and on submit.
  const [partyInput, setPartyInput] = React.useState("1")
  const [answers, setAnswers] = React.useState<Record<string, AnswerValue>>({})
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

  React.useEffect(() => {
    if (resendAfter <= 0) return
    const timer = setInterval(() => setResendAfter((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendAfter])

  const ticket = ticketById(page, ticketTypeId)
  const scopedQuestions = questionsFor(page.questions, ticketTypeId)
  const visibleQuestions = scopedQuestions.filter((question) => questionVisible(question, answers))
  const missing = missingRequired(page.questions, answers, ticketTypeId)
  const needsAccessCode = ticket?.requiresAccessCode === true
  const maxParty = ticket?.maxPartySize ?? 1
  const partySize = clampPartySize(Number(partyInput), maxParty)

  if (windowState === "cancelled") {
    return <WidgetNotice tone="alert" title={t("widget.cancelled_title")} />
  }
  if (windowState === "closed") {
    return <WidgetNotice tone="muted" title={t("widget.closed_title")} />
  }
  if (windowState === "not_yet_open") {
    return (
      <WidgetNotice tone="muted" title={t("widget.not_yet_open_title")}>
        {t("widget.not_yet_open_body")}
      </WidgetNotice>
    )
  }

  if (step.kind === "registered") {
    return <WidgetNotice tone="success" title={t(step.messageKey)} />
  }
  if (step.kind === "waitlisted") {
    return (
      <WidgetNotice tone="success" title={t("widget.waitlisted_title")}>
        {t("widget.waitlisted_body")}
      </WidgetNotice>
    )
  }

  const soldOut = windowState === "sold_out"
  const waitlistOffered = soldOut && waitlistAvailable(ticket, page)
  const canWaitlist = waitlistOffered && isAuthenticated
  const guestWaitlistBlocked = waitlistOffered && !isAuthenticated

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

  const consentPayload = () => ({
    termsVersion: currentVersion("terms"),
    disclosureVersion: page.consentVersions.disclosureVersion,
    hostContactOptIn,
    surface: REGISTRATION_CONSENT_SURFACE,
  })

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
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        setErrorKey("errors.email")
        return false
      }
    }
    setErrorKey(null)
    return true
  }

  const registerAsMember = async () => {
    if (inFlight.current || !validate() || !begin()) return
    try {
      const response = await api.registerForEvent({
        id: page.event.id,
        idempotencyKey: idempotencyKey.current,
        ...(ticketTypeId ? { ticketTypeId } : {}),
        partySize,
        ...(needsAccessCode ? { accessCode: accessCode.trim() } : {}),
        answers: answerPayload(page.questions, answers, ticketTypeId),
        consent: consentPayload(),
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
      setErrorKey(requestErrorKey(cause))
      idempotencyKey.current = newIdempotencyKey()
    } finally {
      finish()
    }
  }

  const requestGuestCode = async () => {
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
        ...(ticketTypeId ? { ticketTypeId } : {}),
        partySize,
        ...(needsAccessCode ? { accessCode: accessCode.trim() } : {}),
        answers: answerPayload(page.questions, answers, ticketTypeId),
        consent: consentPayload(),
        turnstileToken,
        website: "",
      })
      setResendAfter(response.resendAfterSec)
      setOtp("")
      setStep({ kind: "code" })
      setErrorKey(null)
    } catch (cause) {
      setErrorKey(requestErrorKey(cause))
    } finally {
      finish()
    }
  }

  const verifyGuestCode = async () => {
    if (!begin()) return
    try {
      await api.guestRsvpVerify({
        id: page.event.id,
        channel: "email",
        email: guestEmail.trim(),
        ...(ticketTypeId ? { ticketTypeId } : {}),
        partySize,
        ...(needsAccessCode ? { accessCode: accessCode.trim() } : {}),
        answers: answerPayload(page.questions, answers, ticketTypeId),
        consent: consentPayload(),
        code: otp.trim(),
      })
      setStep({ kind: "registered", messageKey: "web-signup:outcome.registered" })
      setErrorKey(null)
    } catch (cause) {
      setErrorKey(requestErrorKey(cause))
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

  const errorMessage = errorKey ? (
    <p className="signup-error" role="alert" id={ERROR_ID}>
      <CircleAlert aria-hidden="true" size={16} /> {t(errorKey)}
    </p>
  ) : null

  if (step.kind === "code") {
    return (
      <section className="signup-widget" aria-labelledby="signup-widget-heading">
        <h2 id="signup-widget-heading">{t("code.title")}</h2>
        <p className="signup-hint">{t("code.sent", { email: guestEmail.trim() })}</p>
        <div className="signup-field">
          <label htmlFor="signup-otp">{t("code.label")}</label>
          <input
            id="signup-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            disabled={busy}
            aria-describedby={errorKey ? ERROR_ID : undefined}
            onChange={(cause) => setOtp(cause.target.value)}
          />
        </div>
        {errorMessage}
        <button
          type="button"
          className="signup-submit"
          disabled={busy || otp.trim().length === 0}
          onClick={() => {
            void verifyGuestCode()
          }}
        >
          {busy ? <Loader2 aria-hidden="true" className="signup-spin" size={16} /> : null}{" "}
          {t("code.submit")}
        </button>
        <button
          type="button"
          className="signup-secondary"
          disabled={busy || resendAfter > 0}
          onClick={() => {
            void requestGuestCode()
          }}
        >
          {resendAfter > 0 ? t("code.resend_wait", { count: resendAfter }) : t("code.resend")}
        </button>
        <button
          type="button"
          className="signup-secondary"
          disabled={busy}
          onClick={() => {
            setErrorKey(null)
            setOtp("")
            setStep({ kind: "form" })
          }}
        >
          {t("code.change_email")}
        </button>
      </section>
    )
  }

  return (
    <section className="signup-widget" aria-labelledby="signup-widget-heading">
      <h2 id="signup-widget-heading">
        {soldOut ? t("form.title_full") : t("form.title_register")}
      </h2>

      {soldOut ? (
        <p className="signup-hint">
          {!waitlistOffered
            ? t("form.full_none")
            : guestWaitlistBlocked
              ? t("form.full_guest")
              : t("form.full_waitlist")}
        </p>
      ) : null}

      {tickets.length > 1 ? (
        <fieldset className="signup-tickets">
          <legend>{t("form.ticket_legend")}</legend>
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
                  setPartyInput("1")
                }}
              />
              <span>
                <strong>{option.name}</strong>
                {option.soldOut ? ` · ${t("form.ticket_sold_out")}` : ""}
                {option.description ? <em>{option.description}</em> : null}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {maxParty > 1 ? (
        <div className="signup-field">
          <label htmlFor="signup-party">{t("form.party_label")}</label>
          <input
            id="signup-party"
            type="number"
            min={1}
            max={maxParty}
            value={partyInput}
            disabled={busy}
            onChange={(cause) => setPartyInput(cause.target.value)}
            onBlur={() => setPartyInput(String(partySize))}
          />
        </div>
      ) : null}

      {needsAccessCode ? (
        <div className="signup-field">
          <label htmlFor="signup-access-code">{t("form.access_code_label")}</label>
          <input
            id="signup-access-code"
            value={accessCode}
            disabled={busy}
            aria-required="true"
            onChange={(cause) => setAccessCode(cause.target.value)}
          />
        </div>
      ) : null}

      {isAuthenticated ? null : (
        <>
          <div className="signup-field">
            <label htmlFor="signup-name">{t("form.name_label")}</label>
            <input
              id="signup-name"
              autoComplete="name"
              value={guestName}
              disabled={busy}
              aria-required="true"
              onChange={(cause) => setGuestName(cause.target.value)}
            />
          </div>
          <div className="signup-field">
            <label htmlFor="signup-email">{t("form.email_label")}</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={guestEmail}
              disabled={busy}
              aria-required="true"
              aria-describedby="signup-email-hint"
              onChange={(cause) => setGuestEmail(cause.target.value)}
            />
            <p className="signup-hint" id="signup-email-hint">
              {t("form.email_hint")}
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
          errorId={errorKey ? ERROR_ID : undefined}
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
        <label htmlFor="signup-host-contact">{t("form.host_contact")}</label>
      </div>

      <div className="signup-check">
        <input
          id="signup-terms"
          type="checkbox"
          checked={termsAccepted}
          disabled={busy}
          aria-required="true"
          aria-invalid={showErrors && !termsAccepted ? true : undefined}
          onChange={(cause) => setTermsAccepted(cause.target.checked)}
        />
        <label htmlFor="signup-terms">
          <Trans
            t={t}
            i18nKey="form.terms"
            components={[
              <a key="terms" href="/legal/terms" rel="noreferrer noopener" target="_blank" />,
              <a key="privacy" href="/legal/privacy" rel="noreferrer noopener" target="_blank" />,
            ]}
          />
        </label>
      </div>

      {errorMessage}

      {canWaitlist ? (
        <button
          type="button"
          className="signup-submit"
          disabled={busy}
          onClick={() => {
            void joinWaitlist()
          }}
        >
          {busy ? <Loader2 aria-hidden="true" className="signup-spin" size={16} /> : null}{" "}
          {t("form.join_waitlist")}
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
          {soldOut
            ? t("form.sold_out")
            : isAuthenticated
              ? t("form.count_me_in")
              : t("form.register")}
        </button>
      )}

      {isAuthenticated || TURNSTILE_SITEKEY ? null : (
        <p className="signup-hint">{t("form.guest_unavailable_hint")}</p>
      )}
    </section>
  )
}

interface QuestionFieldProps {
  question: EventQuestionDTO
  value: AnswerValue | undefined
  invalid: boolean
  /** The widget's error message, linked to an invalid field so it is read with the field. */
  errorId: string | undefined
  disabled: boolean
  onChange: (next: AnswerValue) => void
}

function describedBy(...ids: Array<string | undefined | false>): string | undefined {
  const joined = ids.filter(Boolean).join(" ")
  return joined.length > 0 ? joined : undefined
}

function RequiredMark({ required }: { required: boolean }) {
  return required ? <span aria-hidden="true"> *</span> : null
}

function QuestionField({ question, value, invalid, errorId, disabled, onChange }: QuestionFieldProps) {
  const id = `signup-question-${question.id}`
  const help = question.helpText ? `${id}-help` : undefined
  const describedByIds = describedBy(help, invalid && errorId)
  const helpText = question.helpText ? (
    <p className="signup-hint" id={help}>
      {question.helpText}
    </p>
  ) : null

  if (question.kind === "checkbox" || question.kind === "consent") {
    return (
      <>
        <div className="signup-check">
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            aria-required={question.required ? true : undefined}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedByIds}
            onChange={(cause) => onChange(cause.target.checked)}
          />
          <label htmlFor={id}>
            {question.consentText ?? question.prompt}
            <RequiredMark required={question.required} />
          </label>
        </div>
        {helpText}
      </>
    )
  }

  if (question.kind === "single_select") {
    return (
      <fieldset
        className="signup-field"
        role="radiogroup"
        aria-required={question.required ? true : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedByIds}
      >
        <legend>
          {question.prompt}
          <RequiredMark required={question.required} />
        </legend>
        {helpText}
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
      <fieldset className="signup-field" aria-describedby={describedByIds}>
        <legend>
          {question.prompt}
          <RequiredMark required={question.required} />
        </legend>
        {helpText}
        {question.options.map((option) => (
          <label key={option.value} className="signup-check">
            <input
              type="checkbox"
              value={option.value}
              checked={selected.includes(option.value)}
              disabled={disabled}
              aria-invalid={invalid ? true : undefined}
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
        <RequiredMark required={question.required} />
      </label>
      {helpText}
      {question.kind === "long_text" ? (
        <textarea
          id={id}
          rows={4}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          aria-required={question.required ? true : undefined}
          aria-describedby={describedByIds}
          aria-invalid={invalid ? true : undefined}
          onChange={(cause) => onChange(cause.target.value)}
        />
      ) : (
        <input
          id={id}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          aria-required={question.required ? true : undefined}
          aria-describedby={describedByIds}
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
