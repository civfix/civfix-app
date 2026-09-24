"use client"

import * as React from "react"
import { Mail, Loader2 } from "lucide-react"
import { space } from "@civfix/shared/tokens"

import { Trans, type Translate } from "@civfix/ui/i18n"

import { AppleGlyph, GoogleGlyph } from "@/components/auth/provider-glyphs"
import { otpCode } from "@/lib/otp"

import type { OtpEntry } from "./use-otp-entry"

export type AuthStep = "choices" | "email" | "code"

export function AuthStepHeading({ step, email, t }: { step: AuthStep; email: string; t: Translate }) {
  if (step === "choices") {
    return (
      <>
        <h3 id="cf-auth-title" className="cf-auth-title">
          {t("choices.title")}
        </h3>
        <p className="cf-auth-sub">{t("choices.subtitle")}</p>
      </>
    )
  }
  if (step === "email") {
    return (
      <>
        <h3 id="cf-auth-title" className="cf-auth-title">
          {t("email.title")}
        </h3>
        <p className="cf-auth-sub">{t("email.subtitle")}</p>
      </>
    )
  }
  return (
    <>
      <h3 id="cf-auth-title" className="cf-auth-title">
        {t("code.title")}
      </h3>
      <p className="cf-auth-sub">
        <Trans t={t} i18nKey="code.subtitle" values={{ email }} components={[<strong key="email" />]} />
      </p>
    </>
  )
}

interface ChoicesStepProps {
  t: Translate
  showApple: boolean
  showGoogle: boolean
  onOAuth: (provider: "google" | "apple") => void
  onEmail: () => void
}

export function ChoicesStep({ t, showApple, showGoogle, onOAuth, onEmail }: ChoicesStepProps) {
  return (
    <>
      {(showApple || showGoogle) && (
        <>
          <div className="cf-auth-methods">
            {showApple && (
              <button type="button" className="auth-method" onClick={() => onOAuth("apple")}>
                <AppleGlyph />
                {t("choices.continue_apple")}
              </button>
            )}
            {showGoogle && (
              <button type="button" className="auth-method" onClick={() => onOAuth("google")}>
                <GoogleGlyph />
                {t("choices.continue_google")}
              </button>
            )}
          </div>

          <div className="auth-divider">{t("choices.divider")}</div>
        </>
      )}

      <button type="button" className="auth-method email-pill" onClick={onEmail}>
        <Mail width={18} height={18} aria-hidden="true" />
        {t("choices.continue_email")}
      </button>

      <div className="cf-auth-trust">{t("choices.trust")}</div>
      {/* No consent disclaimer here: consent is the explicit checkbox in the first-run gate. */}
    </>
  )
}

interface EmailStepProps {
  t: Translate
  email: string
  onEmailChange: (email: string) => void
  submitting: boolean
  error: string | null
  onSubmit: (event: React.FormEvent) => void
}

export function EmailStep({ t, email, onEmailChange, submitting, error, onSubmit }: EmailStepProps) {
  return (
    <form className="cf-auth-form" onSubmit={onSubmit}>
      <input
        className="input cf-auth-email-input"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoFocus
        required
        placeholder={t("email.placeholder")}
        value={email}
        onChange={(event) => onEmailChange(event.target.value)}
        aria-label={t("email.aria_label")}
      />
      <button
        type="submit"
        className="btn primary block lg"
        disabled={submitting || !email.includes("@")}
      >
        {submitting && <Loader2 className="cf-spin h-4 w-4" aria-hidden="true" />}
        {t("email.submit")}
      </button>
      {error && (
        <p role="alert" className="cf-auth-error">
          {error}
        </p>
      )}
    </form>
  )
}

interface CodeStepProps {
  t: Translate
  otp: OtpEntry
  length: number
  submitting: boolean
  error: string | null
  resendAfter: number
  onType: (index: number, raw: string) => void
  onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void
  onVerify: (code: string) => void
  onResend: () => void
  onUseDifferentEmail: () => void
}

export function CodeStep({
  t,
  otp,
  length,
  submitting,
  error,
  resendAfter,
  onType,
  onPaste,
  onVerify,
  onResend,
  onUseDifferentEmail,
}: CodeStepProps) {
  return (
    <>
      <div
        className="otp-row"
        style={{ marginBottom: space["4"] }}
        onPaste={onPaste}
        role="group"
        aria-label={t("code.group_aria_label")}
      >
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              otp.refs.current[i] = el
            }}
            className="otp-cell"
            value={otp.cells[i] ?? ""}
            autoFocus={i === 0}
            onChange={(event) => onType(i, event.target.value)}
            onKeyDown={(event) => otp.onKeyDown(i, event)}
            maxLength={1}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            disabled={submitting}
            aria-label={t("code.digit_aria_label", { position: i + 1 })}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="cf-auth-error" style={{ marginBottom: space["3"] }}>
          {error}
        </p>
      )}

      {/* The fallback when autofocus or auto-submit on the last digit does not fire. */}
      <button
        type="button"
        className="btn primary block lg"
        style={{ marginBottom: space["3"] }}
        disabled={otpCode(otp.cells) === null || submitting}
        onClick={() => {
          const complete = otpCode(otp.cells)
          if (complete !== null) onVerify(complete)
        }}
      >
        {submitting && <Loader2 className="cf-spin h-4 w-4" aria-hidden="true" />}
        {submitting ? t("code.verifying") : t("code.verify")}
      </button>

      <div className="cf-auth-resend">
        {t("code.resend_prompt")}{" "}
        <button type="button" disabled={resendAfter > 0 || submitting} onClick={onResend}>
          {resendAfter > 0
            ? t("code.resend_countdown", { count: resendAfter })
            : t("code.resend")}
        </button>
      </div>
      <button type="button" className="btn ghost block" onClick={onUseDifferentEmail}>
        {t("code.use_different_email")}
      </button>
    </>
  )
}
