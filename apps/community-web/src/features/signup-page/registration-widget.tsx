"use client"

import * as React from "react"
import { CircleAlert, Loader2 } from "lucide-react"
import type { PublicEventPageDTO } from "@civfix/shared"

import { Trans, useT } from "@civfix/ui/i18n"
import type { Translate } from "@civfix/ui/i18n"

import { TURNSTILE_SITEKEY } from "@/lib/turnstile"

import { QuestionField } from "./registration-question-field"
import { useRegistrationFlow, type RegistrationFlow } from "./use-registration-flow"

const ERROR_ID = "signup-widget-error"

interface RegistrationWidgetProps {
  page: PublicEventPageDTO
  initialAccessCode: string | null
}

export function RegistrationWidget({ page, initialAccessCode }: RegistrationWidgetProps) {
  const { t } = useT("web-signup")
  const flow = useRegistrationFlow(page, initialAccessCode)

  if (flow.windowState === "cancelled") {
    return <WidgetNotice tone="alert" title={t("widget.cancelled_title")} />
  }
  if (flow.windowState === "closed") {
    return <WidgetNotice tone="muted" title={t("widget.closed_title")} />
  }
  if (flow.windowState === "not_yet_open") {
    return (
      <WidgetNotice tone="muted" title={t("widget.not_yet_open_title")}>
        {t("widget.not_yet_open_body")}
      </WidgetNotice>
    )
  }

  if (flow.step.kind === "registered") {
    return <WidgetNotice tone="success" title={t(flow.step.messageKey)} />
  }
  if (flow.step.kind === "waitlisted") {
    return (
      <WidgetNotice tone="success" title={t("widget.waitlisted_title")}>
        {t("widget.waitlisted_body")}
      </WidgetNotice>
    )
  }

  const errorMessage = flow.errorKey ? (
    <p className="signup-error" role="alert" id={ERROR_ID}>
      <CircleAlert aria-hidden="true" size={16} /> {t(flow.errorKey)}
    </p>
  ) : null

  if (flow.step.kind === "code") {
    return <GuestCodeStep flow={flow} t={t} errorMessage={errorMessage} />
  }
  return <RegistrationForm flow={flow} t={t} errorMessage={errorMessage} />
}

interface StepProps {
  flow: RegistrationFlow
  t: Translate
  errorMessage: React.ReactNode
}

function GuestCodeStep({ flow, t, errorMessage }: StepProps) {
  const { busy, otp, resendAfter } = flow
  return (
    <section className="signup-widget" aria-labelledby="signup-widget-heading">
      <h2 id="signup-widget-heading">{t("code.title")}</h2>
      <p className="signup-hint">{t("code.sent", { email: flow.guestEmail.trim() })}</p>
      <div className="signup-field">
        <label htmlFor="signup-otp">{t("code.label")}</label>
        <input
          id="signup-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={otp}
          disabled={busy}
          aria-describedby={flow.errorKey ? ERROR_ID : undefined}
          onChange={(event) => flow.setOtp(event.target.value)}
        />
      </div>
      {errorMessage}
      <button
        type="button"
        className="signup-submit"
        disabled={busy || otp.trim().length === 0}
        onClick={() => {
          void flow.verifyGuestCode()
        }}
      >
        <BusySpinner busy={busy} />
        {t("code.submit")}
      </button>
      <button
        type="button"
        className="signup-secondary"
        disabled={busy || resendAfter > 0}
        onClick={() => {
          void flow.requestGuestCode()
        }}
      >
        {resendAfter > 0 ? t("code.resend_wait", { count: resendAfter }) : t("code.resend")}
      </button>
      <button type="button" className="signup-secondary" disabled={busy} onClick={flow.backToForm}>
        {t("code.change_email")}
      </button>
    </section>
  )
}

function RegistrationForm({ flow, t, errorMessage }: StepProps) {
  const { busy, soldOut, isAuthenticated, showErrors, termsAccepted } = flow
  return (
    <section className="signup-widget" aria-labelledby="signup-widget-heading">
      <h2 id="signup-widget-heading">
        {soldOut ? t("form.title_full") : t("form.title_register")}
      </h2>

      {soldOut ? (
        <p className="signup-hint">
          {!flow.waitlistOffered
            ? t("form.full_none")
            : flow.guestWaitlistBlocked
              ? t("form.full_guest")
              : t("form.full_waitlist")}
        </p>
      ) : null}

      {flow.tickets.length > 1 ? <TicketPicker flow={flow} t={t} /> : null}

      {flow.maxParty > 1 ? (
        <div className="signup-field">
          <label htmlFor="signup-party">{t("form.party_label")}</label>
          <input
            id="signup-party"
            type="number"
            min={1}
            max={flow.maxParty}
            value={flow.partyInput}
            disabled={busy}
            onChange={(event) => flow.setPartyInput(event.target.value)}
            onBlur={() => flow.setPartyInput(String(flow.partySize))}
          />
        </div>
      ) : null}

      {flow.needsAccessCode ? (
        <div className="signup-field">
          <label htmlFor="signup-access-code">{t("form.access_code_label")}</label>
          <input
            id="signup-access-code"
            value={flow.accessCode}
            disabled={busy}
            aria-required="true"
            onChange={(event) => flow.setAccessCode(event.target.value)}
          />
        </div>
      ) : null}

      {isAuthenticated ? null : <GuestIdentityFields flow={flow} t={t} />}

      {flow.visibleQuestions.map((question) => (
        <QuestionField
          key={question.id}
          question={question}
          value={flow.answers[question.id]}
          invalid={showErrors && flow.missing.includes(question.id)}
          errorId={flow.errorKey ? ERROR_ID : undefined}
          disabled={busy}
          onChange={(next) => flow.setAnswer(question.id, next)}
        />
      ))}

      <div className="signup-check">
        <input
          id="signup-host-contact"
          type="checkbox"
          checked={flow.hostContactOptIn}
          disabled={busy}
          onChange={(event) => flow.setHostContactOptIn(event.target.checked)}
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
          onChange={(event) => flow.setTermsAccepted(event.target.checked)}
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

      {flow.canWaitlist ? (
        <button
          type="button"
          className="signup-submit"
          disabled={busy}
          onClick={() => {
            void flow.joinWaitlist()
          }}
        >
          <BusySpinner busy={busy} />
          {t("form.join_waitlist")}
        </button>
      ) : (
        <button
          type="button"
          className="signup-submit"
          disabled={busy || soldOut}
          onClick={() => {
            void (isAuthenticated ? flow.registerAsMember() : flow.requestGuestCode())
          }}
        >
          <BusySpinner busy={busy} />
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

function TicketPicker({ flow, t }: { flow: RegistrationFlow; t: Translate }) {
  return (
    <fieldset className="signup-tickets">
      <legend>{t("form.ticket_legend")}</legend>
      {flow.tickets.map((option) => (
        <label key={option.id} className="signup-ticket" data-sold-out={String(option.soldOut)}>
          <input
            type="radio"
            name="signup-ticket"
            value={option.id}
            checked={flow.ticketTypeId === option.id}
            disabled={flow.busy}
            onChange={() => flow.chooseTicket(option.id)}
          />
          <span>
            <strong>{option.name}</strong>
            {option.soldOut ? ` · ${t("form.ticket_sold_out")}` : ""}
            {option.description ? <em>{option.description}</em> : null}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function GuestIdentityFields({ flow, t }: { flow: RegistrationFlow; t: Translate }) {
  return (
    <>
      <div className="signup-field">
        <label htmlFor="signup-name">{t("form.name_label")}</label>
        <input
          id="signup-name"
          autoComplete="name"
          value={flow.guestName}
          disabled={flow.busy}
          aria-required="true"
          onChange={(event) => flow.setGuestName(event.target.value)}
        />
      </div>
      <div className="signup-field">
        <label htmlFor="signup-email">{t("form.email_label")}</label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          value={flow.guestEmail}
          disabled={flow.busy}
          aria-required="true"
          aria-describedby="signup-email-hint"
          onChange={(event) => flow.setGuestEmail(event.target.value)}
        />
        <p className="signup-hint" id="signup-email-hint">
          {t("form.email_hint")}
        </p>
      </div>
    </>
  )
}

// The trailing space is part of the button label and renders whether or not the spinner does.
function BusySpinner({ busy }: { busy: boolean }) {
  return (
    <>
      {busy ? <Loader2 aria-hidden="true" className="signup-spin" size={16} /> : null}{" "}
    </>
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
