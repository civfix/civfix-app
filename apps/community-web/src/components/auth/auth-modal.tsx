"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Mail, Loader2, X } from "lucide-react"

import { Trans, useT } from "@civfix/ui/i18n"

import { AppleGlyph, GoogleGlyph } from "@/components/auth/provider-glyphs"
import { api, API_BASE_URL } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { oauthRedirectTarget } from "@/lib/oauth-return"
import { applyOtpInput } from "@/lib/otp"
import { useRefreshSession } from "@/hooks/use-auth"
import { useVisualViewportShift } from "@/hooks/use-visual-viewport-shift"
import { useAuthStore } from "@/store/auth-store"
import { useUiStore } from "@/store/ui-store"

type Step = "choices" | "email" | "code"

const OTP_LENGTH = 6

/**
 * Redirect to a backend OAuth start endpoint, asking it to return to the current origin - or to a
 * same-origin console path (`returnPath`, allowlisted by oauthReturnPath) when the caller has one to
 * come back to, such as an org invite waiting to be accepted. Only providers with a working web
 * redirect flow are offered here: Google, and Apple when the server has the Sign in with Apple WEB
 * Services ID configured (APPLE_OAUTH_WEB_CLIENT_ID). Both are surfaced via enabledProviders and land
 * on /auth/{provider}/start, which sets the cookie session on the callback and redirects back.
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

/**
 * The "Welcome to civfix" authentication modal, restyled to the design (panels-social.jsx AuthModal):
 * a 24px warm-paper modal card with a gradient header band (moss-50 -> sun-50) carrying the step-aware
 * copy, then the .auth-method pill buttons (Apple / Google / Continue with email), the email field, and
 * the 6-cell .otp-cell grid with Resend.
 *
 * IMPORTANT: only the PRESENTATION is rebuilt. The auth wiring is unchanged:
 *  - Google / Apple: full-page redirect to the API OAuth start endpoints (cookie session is set on the
 *    callback, then the API redirects back to the app).
 *  - Email: POST /auth/otp/request -> 6-digit code -> POST /auth/otp/verify. The verify response carries
 *    the user AND the CSRF token (web cookie flow); we capture BOTH immediately via setSession so the
 *    very next mutation can echo x-csrf-token, then refresh the auth store from /auth/session and close.
 *
 * Open state is controlled via the UI store so any "Sign in" button can open it.
 */
export function AuthModal({ oauthReturnPath = null }: AuthModalProps = {}) {
  const { t } = useT("web-auth")
  const open = useUiStore((s) => s.authModalOpen)
  const setOpen = useUiStore((s) => s.setAuthModalOpen)
  const refreshSession = useRefreshSession()
  const setSession = useAuthStore((s) => s.setSession)
  const enabledProviders = useAuthStore((s) => s.enabledProviders)

  const [step, setStep] = React.useState<Step>("choices")
  const [email, setEmail] = React.useState("")
  const [code, setCode] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [resendAfter, setResendAfter] = React.useState<number>(0)

  const otpRefs = React.useRef<Array<HTMLInputElement | null>>([])

  // Reset the internal flow whenever the dialog is closed.
  React.useEffect(() => {
    if (!open) {
      setStep("choices")
      setEmail("")
      setCode("")
      setError(null)
      setSubmitting(false)
      setResendAfter(0)
    }
  }, [open])

  // Tick down the resend cooldown.
  React.useEffect(() => {
    if (resendAfter <= 0) return
    const t = setInterval(() => setResendAfter((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendAfter])

  // Close on Escape while open (parity with the previous Dialog behavior).
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, setOpen])

  // Keep the centered card above the soft keyboard on mobile web. `.modal-card` is `position:fixed` centered
  // in the LAYOUT viewport (top:50%/translateY(-50%)), which the keyboard does not shrink - so the email
  // input / OTP cells would sit under it. The shared hook shifts the card so it stays centered in the
  // VISIBLE area above the keyboard (0 while closed, and on desktop / with no keyboard).
  const vvShift = useVisualViewportShift(open)

  const requestCode = React.useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      setError(null)
      setSubmitting(true)
      try {
        const res = await api.otpRequest({ email })
        setResendAfter(res.resendAfterSec)
        setCode("")
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
        // The verify response carries the user AND the CSRF token (web cookie flow). Capture both
        // immediately so the very next mutation can echo x-csrf-token, without waiting on the
        // /auth/session refresh below (which may or may not re-issue the token).
        const res = await api.otpVerify({ email, code: rawCode })
        setSession({
          user: res.user,
          csrfToken: res.csrfToken,
          guestSmsEnabled: res.guestSmsEnabled,
        })
        // Refresh roles and let protected queries refetch under the new identity. The store preserves
        // the CSRF token captured above if the session check does not return one.
        await refreshSession()
        setOpen(false)
      } catch (err) {
        setError(authErrorMessage(err, t))
        // Clear the entry so the user can re-key the code.
        setCode("")
        otpRefs.current[0]?.focus()
      } finally {
        setSubmitting(false)
      }
    },
    [email, refreshSession, setSession, setOpen, t],
  )

  // Apply input at cell i and keep the single `code` string in sync. `raw` may be one typed digit OR
  // several at once - a paste, or the browser autofilling the whole one-time-code into the first cell
  // (cell 0 carries autoComplete="one-time-code"). applyOtpInput distributes the digits across cells and
  // tells us where to move focus and whether the code is now complete; we then auto-submit. The verify
  // pipeline is unchanged. (The previous `!next.includes("")` guard was always false - every string
  // includes the empty string - so typing the code never auto-submitted.)
  const setOtpAt = React.useCallback(
    (i: number, raw: string) => {
      const { code: next, focusIndex, complete } = applyOtpInput(code, i, raw, OTP_LENGTH)
      setCode(next)
      otpRefs.current[focusIndex]?.focus()
      if (complete && !submitting) {
        // Defer so React commits the final digit before we verify.
        setTimeout(() => verifyCode(next), 0)
      }
      setError(null)
    },
    [code, submitting, verifyCode],
  )

  const onOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      otpRefs.current[i - 1]?.focus()
    }
  }

  const onOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text")
    if (!text.replace(/\D/g, "")) return
    e.preventDefault()
    // Paste fills from the first cell. Route through the same distribution logic as typing/autofill.
    const { code: next, focusIndex, complete } = applyOtpInput("", 0, text, OTP_LENGTH)
    setCode(next)
    otpRefs.current[focusIndex]?.focus()
    if (complete && !submitting) setTimeout(() => verifyCode(next), 0)
    setError(null)
  }

  if (!open) return null
  if (typeof document === "undefined") return null

  // Until the session check has populated providers (it always includes "email" once loaded),
  // optimistically show Google so it isn't hidden during the brief hydration window; once known, gate
  // strictly so the button only appears when the server has Google OAuth configured.
  const providersKnown = enabledProviders.length > 0
  const showGoogle = providersKnown ? enabledProviders.includes("google") : true
  // Apple appears only once the server CONFIRMS it (its web flow needs a Services ID). Unlike Google we do
  // NOT optimistically show it during the brief hydration window, since most deployments won't have web
  // Apple configured and a button that flashes in then vanishes is worse than one that appears a beat late.
  const showApple = providersKnown ? enabledProviders.includes("apple") : false

  const goBack = () => {
    setError(null)
    setStep(step === "code" ? "email" : "choices")
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="cf-auth-title">
      <div className="modal-scrim" aria-hidden="true" onClick={() => setOpen(false)} />
      <div
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
              {/* The Terms/Privacy consent disclaimer that used to sit here is removed: consent is now
                  captured by the explicit TermsConfirmation checkbox in the first-run onboarding gate
                  (features/auth/first-run-gate.tsx), which the user must check before Continue enables. */}
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
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el
                    }}
                    className="otp-cell"
                    value={code[i] ?? ""}
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

              {/* Explicit submit. Auto-submit fires on the 6th digit, but the user can always click
                  here - and this is the fallback if autofocus/auto-submit does not fire. */}
              <button
                type="button"
                className="btn primary block lg"
                style={{ marginBottom: 12 }}
                disabled={code.length !== OTP_LENGTH || submitting}
                onClick={() => verifyCode(code)}
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

/**
 * Friendly copy for the handful of auth errors the user can act on. Maps server error CODES (not raw
 * server message text) to localized client strings; the caller passes its namespace-bound `t` since this
 * module-level helper cannot call the `useT` hook itself.
 */
function authErrorMessage(err: unknown, t: (key: string) => string): string {
  return errorMessage(err, {
    VALIDATION: t("errors.VALIDATION"),
    RATE_LIMITED: t("errors.RATE_LIMITED"),
    UNAUTHORIZED: t("errors.UNAUTHORIZED"),
  })
}
