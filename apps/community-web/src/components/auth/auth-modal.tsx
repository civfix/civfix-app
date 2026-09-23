"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Mail, Loader2, X } from "lucide-react"

import { Trans, useT } from "@civfix/ui/i18n"

import { AppleGlyph, GoogleGlyph } from "@/components/auth/provider-glyphs"
import { useFocusTrap } from "@/components/console/overlay/use-focus-trap"
import { api, API_BASE_URL } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { oauthRedirectTarget } from "@/lib/oauth-return"
import { applyOtpInput, emptyOtpCells, otpCode } from "@/lib/otp"
import { useRefreshSession } from "@/hooks/use-auth"
import { useVisualViewportShift } from "@/hooks/use-visual-viewport-shift"
import { useAuthStore } from "@/store/auth-store"
import { useUiStore } from "@/store/ui-store"

type Step = "choices" | "email" | "code"

const OTP_LENGTH = 6

/**
 * The return target is the current origin, or a same-origin console path allowlisted by oauthReturnPath
 * (such as an org invite waiting to be accepted). Apple is offered only when the server has a Sign in
 * with Apple web Services ID configured.
 */
function startOAuth(provider: "google" | "apple", returnPath?: string | null) {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const redirect = oauthRedirectTarget(origin, returnPath)
  const url = `${API_BASE_URL}/auth/${provider}/start?redirect=${encodeURIComponent(redirect)}`
  window.location.assign(url)
}

export interface AuthModalProps {
  /**
   * Same-origin console path the OAuth providers should land on instead of the site root. Anything
   * outside `/manage/` is ignored (see oauthReturnPath). Email OTP never leaves the page, so it needs
   * no such hint.
   */
  oauthReturnPath?: string | null
}

export function AuthModal({ oauthReturnPath = null }: AuthModalProps = {}) {
  const { t } = useT("web-auth")
  const open = useUiStore((s) => s.authModalOpen)
  const setOpen = useUiStore((s) => s.setAuthModalOpen)
  const refreshSession = useRefreshSession()
  const setSession = useAuthStore((s) => s.setSession)
  const enabledProviders = useAuthStore((s) => s.enabledProviders)

  const [step, setStep] = React.useState<Step>("choices")
  const [email, setEmail] = React.useState("")
  const [cells, setCells] = React.useState<string[]>(() => emptyOtpCells(OTP_LENGTH))
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [resendAfter, setResendAfter] = React.useState<number>(0)
  const [failedVerifies, setFailedVerifies] = React.useState(0)

  const otpRefs = React.useRef<Array<HTMLInputElement | null>>([])
  const cardRef = React.useRef<HTMLDivElement | null>(null)
  useFocusTrap(cardRef, open)

  React.useEffect(() => {
    if (!open) {
      setStep("choices")
      setEmail("")
      setCells(emptyOtpCells(OTP_LENGTH))
      setError(null)
      setSubmitting(false)
      setResendAfter(0)
      setFailedVerifies(0)
    }
  }, [open])

  React.useEffect(() => {
    if (resendAfter <= 0) return
    const t = setInterval(() => setResendAfter((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendAfter])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, setOpen])

  // `.modal-card` is centered in the layout viewport, which the mobile soft keyboard does not shrink, so
  // the inputs would sit under the keyboard. The shift re-centers the card in the visible area above it.
  const vvShift = useVisualViewportShift(open)

  const requestCode = React.useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      setError(null)
      setSubmitting(true)
      try {
        const res = await api.otpRequest({ email })
        setResendAfter(res.resendAfterSec)
        setCells(emptyOtpCells(OTP_LENGTH))
        setStep("code")
      } catch (err) {
        setError(authErrorMessage(err, t))
      } finally {
        setSubmitting(false)
      }
    },
    [email, t],
  )

  const verifyCode = React.useCallback(
    async (rawCode: string) => {
      setError(null)
      setSubmitting(true)
      try {
        // Capture the CSRF token from the verify response so the very next mutation can echo it: the
        // /auth/session refresh below may not re-issue the token.
        const res = await api.otpVerify({ email, code: rawCode })
        setSession({
          user: res.user,
          csrfToken: res.csrfToken,
          guestSmsEnabled: res.guestSmsEnabled,
        })
        await refreshSession()
        setOpen(false)
      } catch (err) {
        setError(authErrorMessage(err, t))
        setCells(emptyOtpCells(OTP_LENGTH))
        setFailedVerifies((n) => n + 1)
      } finally {
        setSubmitting(false)
      }
    },
    [email, refreshSession, setSession, setOpen, t],
  )

  // The cells are disabled while a verify is in flight, so a failed verify can only return focus to the
  // first cell after `submitting` has committed back to false.
  React.useEffect(() => {
    if (failedVerifies > 0 && !submitting) otpRefs.current[0]?.focus()
  }, [failedVerifies, submitting])

  // `raw` may carry several digits: a paste, or the browser autofilling the whole one-time code into the
  // first cell. Submitting with the code in hand avoids waiting for the render that shows the last digit.
  const setOtpAt = React.useCallback(
    (i: number, raw: string) => {
      const { cells: next, focusIndex } = applyOtpInput(cells, i, raw)
      setCells(next)
      otpRefs.current[focusIndex]?.focus()
      setError(null)
      const complete = otpCode(next)
      if (complete !== null && !submitting) void verifyCode(complete)
    },
    [cells, submitting, verifyCode],
  )

  const onOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !cells[i] && i > 0) {
      otpRefs.current[i - 1]?.focus()
    }
  }

  const onOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text")
    if (!text.replace(/\D/g, "")) return
    e.preventDefault()
    const { cells: next, focusIndex } = applyOtpInput(emptyOtpCells(OTP_LENGTH), 0, text)
    setCells(next)
    otpRefs.current[focusIndex]?.focus()
    setError(null)
    const complete = otpCode(next)
    if (complete !== null && !submitting) void verifyCode(complete)
  }

  if (!open) return null
  if (typeof document === "undefined") return null

  // Once loaded, providers always include "email", so an empty list means the session check has not
  // answered yet; Google shows optimistically during that window.
  const providersKnown = enabledProviders.length > 0
  const showGoogle = providersKnown ? enabledProviders.includes("google") : true
  // Apple waits for confirmation: most deployments lack a web Services ID, and a button that flashes in
  // then vanishes is worse than one that appears a beat late.
  const showApple = providersKnown ? enabledProviders.includes("apple") : false

  const goBack = () => {
    setError(null)
    setStep(step === "code" ? "email" : "choices")
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="cf-auth-title">
      <div className="modal-scrim" aria-hidden="true" onClick={() => setOpen(false)} />
      <div
        ref={cardRef}
        className="modal-card"
        style={vvShift ? { transform: `translate(-50%, calc(-50% + ${vvShift}px))` } : undefined}
      >
        <div className="cf-auth-header">
          {step !== "choices" && (
            <button type="button" className="cf-auth-back" onClick={goBack}>
              {t("back")}
            </button>
          )}
          <button
            type="button"
            className="cf-auth-close"
            onClick={() => setOpen(false)}
            aria-label={t("close")}
          >
            <X width={16} height={16} aria-hidden="true" />
          </button>

          {step === "choices" && (
            <>
              <h3 id="cf-auth-title" className="cf-auth-title">
                {t("choices.title")}
              </h3>
              <p className="cf-auth-sub">{t("choices.subtitle")}</p>
            </>
          )}
          {step === "email" && (
            <>
              <h3 id="cf-auth-title" className="cf-auth-title">
                {t("email.title")}
              </h3>
              <p className="cf-auth-sub">{t("email.subtitle")}</p>
            </>
          )}
          {step === "code" && (
            <>
              <h3 id="cf-auth-title" className="cf-auth-title">
                {t("code.title")}
              </h3>
              <p className="cf-auth-sub">
                <Trans
                  t={t}
                  i18nKey="code.subtitle"
                  values={{ email }}
                  components={[<strong key="email" />]}
                />
              </p>
            </>
          )}
        </div>

        <div className="cf-auth-body">
          {step === "choices" && (
            <>
              {(showApple || showGoogle) && (
                <>
                  <div className="cf-auth-methods">
                    {showApple && (
                      <button
                        type="button"
                        className="auth-method"
                        onClick={() => startOAuth("apple", oauthReturnPath)}
                      >
                        <AppleGlyph />
                        {t("choices.continue_apple")}
                      </button>
                    )}
                    {showGoogle && (
                      <button
                        type="button"
                        className="auth-method"
                        onClick={() => startOAuth("google", oauthReturnPath)}
                      >
                        <GoogleGlyph />
                        {t("choices.continue_google")}
                      </button>
                    )}
                  </div>

                  <div className="auth-divider">{t("choices.divider")}</div>
                </>
              )}

              <button
                type="button"
                className="auth-method email-pill"
                onClick={() => setStep("email")}
              >
                <Mail width={18} height={18} aria-hidden="true" />
                {t("choices.continue_email")}
              </button>

              <div className="cf-auth-trust">{t("choices.trust")}</div>
              {/* No consent disclaimer here: consent is the explicit checkbox in the first-run gate. */}
            </>
          )}

          {step === "email" && (
            <form className="cf-auth-form" onSubmit={requestCode}>
              <input
                className="input cf-auth-email-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                required
                placeholder={t("email.placeholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
          )}

          {step === "code" && (
            <>
              <div
                className="otp-row"
                style={{ marginBottom: 16 }}
                onPaste={onOtpPaste}
                role="group"
                aria-label={t("code.group_aria_label")}
              >
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el
                    }}
                    className="otp-cell"
                    value={cells[i] ?? ""}
                    autoFocus={i === 0}
                    onChange={(e) => setOtpAt(i, e.target.value)}
                    onKeyDown={(e) => onOtpKeyDown(i, e)}
                    maxLength={1}
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    disabled={submitting}
                    aria-label={t("code.digit_aria_label", { position: i + 1 })}
                  />
                ))}
              </div>

              {error && (
                <p role="alert" className="cf-auth-error" style={{ marginBottom: 12 }}>
                  {error}
                </p>
              )}

              {/* The fallback when autofocus or auto-submit on the last digit does not fire. */}
              <button
                type="button"
                className="btn primary block lg"
                style={{ marginBottom: 12 }}
                disabled={otpCode(cells) === null || submitting}
                onClick={() => {
                  const complete = otpCode(cells)
                  if (complete !== null) void verifyCode(complete)
                }}
              >
                {submitting && <Loader2 className="cf-spin h-4 w-4" aria-hidden="true" />}
                {submitting ? t("code.verifying") : t("code.verify")}
              </button>

              <div className="cf-auth-resend">
                {t("code.resend_prompt")}{" "}
                <button
                  type="button"
                  disabled={resendAfter > 0 || submitting}
                  onClick={() => requestCode()}
                >
                  {resendAfter > 0
                    ? t("code.resend_countdown", { count: resendAfter })
                    : t("code.resend")}
                </button>
              </div>
              <button
                type="button"
                className="btn ghost block"
                onClick={() => {
                  setError(null)
                  setStep("email")
                }}
              >
                {t("code.use_different_email")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Maps server error codes, never raw server message text, to localized copy. */
function authErrorMessage(err: unknown, t: (key: string) => string): string {
  return errorMessage(err, {
    VALIDATION: t("errors.VALIDATION"),
    RATE_LIMITED: t("errors.RATE_LIMITED"),
    UNAUTHORIZED: t("errors.UNAUTHORIZED"),
  })
}
