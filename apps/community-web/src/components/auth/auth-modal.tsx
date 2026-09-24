"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { useT } from "@civfix/ui/i18n"

import { useFocusTrap } from "@/components/console/overlay/use-focus-trap"
import { api, API_BASE_URL } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { oauthRedirectTarget } from "@/lib/oauth-return"
import { useRefreshSession } from "@/hooks/use-auth"
import { useVisualViewportShift } from "@/hooks/use-visual-viewport-shift"
import { useAuthStore } from "@/store/auth-store"
import { useUiStore } from "@/store/ui-store"

import { AuthStepHeading, ChoicesStep, CodeStep, EmailStep, type AuthStep } from "./auth-modal-steps"
import { useOtpEntry } from "./use-otp-entry"

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

  const [step, setStep] = React.useState<AuthStep>("choices")
  const [email, setEmail] = React.useState("")
  const otp = useOtpEntry(OTP_LENGTH)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [resendAfter, setResendAfter] = React.useState<number>(0)
  const [failedVerifies, setFailedVerifies] = React.useState(0)

  const cardRef = React.useRef<HTMLDivElement | null>(null)
  useFocusTrap(cardRef, open)

  const clearOtp = otp.clear
  React.useEffect(() => {
    if (!open) {
      setStep("choices")
      setEmail("")
      clearOtp()
      setError(null)
      setSubmitting(false)
      setResendAfter(0)
      setFailedVerifies(0)
    }
  }, [open, clearOtp])

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

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await api.otpRequest({ email })
      setResendAfter(res.resendAfterSec)
      otp.clear()
      setStep("code")
    } catch (err) {
      setError(authErrorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  const verifyCode = async (rawCode: string) => {
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
      otp.clear()
      setFailedVerifies((n) => n + 1)
    } finally {
      setSubmitting(false)
    }
  }

  // The cells are disabled while a verify is in flight, so a failed verify can only return focus to the
  // first cell after `submitting` has committed back to false.
  const otpRefs = otp.refs
  React.useEffect(() => {
    if (failedVerifies > 0 && !submitting) otpRefs.current[0]?.focus()
  }, [failedVerifies, submitting, otpRefs])

  const submitIfComplete = (complete: string | null) => {
    setError(null)
    if (complete !== null && !submitting) void verifyCode(complete)
  }

  // `raw` may carry several digits: a paste, or the browser autofilling the whole one-time code into the
  // first cell. Submitting with the code in hand avoids waiting for the render that shows the last digit.
  const setOtpAt = (i: number, raw: string) => submitIfComplete(otp.type(i, raw))

  const onOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text")
    if (!text.replace(/\D/g, "")) return
    e.preventDefault()
    submitIfComplete(otp.paste(text))
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

          <AuthStepHeading step={step} email={email} t={t} />
        </div>

        <div className="cf-auth-body">
          {step === "choices" && (
            <ChoicesStep
              t={t}
              showApple={showApple}
              showGoogle={showGoogle}
              onOAuth={(provider) => startOAuth(provider, oauthReturnPath)}
              onEmail={() => setStep("email")}
            />
          )}

          {step === "email" && (
            <EmailStep
              t={t}
              email={email}
              onEmailChange={setEmail}
              submitting={submitting}
              error={error}
              onSubmit={requestCode}
            />
          )}

          {step === "code" && (
            <CodeStep
              t={t}
              otp={otp}
              length={OTP_LENGTH}
              submitting={submitting}
              error={error}
              resendAfter={resendAfter}
              onType={setOtpAt}
              onPaste={onOtpPaste}
              onVerify={(complete) => void verifyCode(complete)}
              onResend={() => void requestCode()}
              onUseDifferentEmail={() => {
                setError(null)
                setStep("email")
              }}
            />
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
