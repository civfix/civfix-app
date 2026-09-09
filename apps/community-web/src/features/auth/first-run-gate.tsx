"use client"

import * as React from "react"
import { Loader2, Check, X } from "lucide-react"
import { isValidHandle } from "@civfix/shared"

import { Avatar, AgeConfirmation, TermsConfirmation } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { useCurrentUser, useLogout } from "@/hooks/use-auth"
import { useVisualViewportShift } from "@/hooks/use-visual-viewport-shift"
import {
  useFirstRunRequired,
  useHandleAvailability,
  useUpdateProfile,
} from "@/hooks/use-profile-registration"
import { errorMessage } from "@/lib/error-messages"

export function FirstRunGate() {
  const required = useFirstRunRequired()
  if (!required) return null
  return <FirstRunForm />
}

function splitName(displayName: string): { first: string; last: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: "", last: "" }
  return { first: parts[0]!, last: parts.slice(1).join(" ") }
}

function FirstRunForm() {
  const { t } = useT("web-registration")
  const user = useCurrentUser()!
  const logout = useLogout()
  const update = useUpdateProfile()

  const seeded = React.useMemo(() => splitName(user.displayName), [user.displayName])
  const [first, setFirst] = React.useState(seeded.first)
  const [last, setLast] = React.useState(seeded.last)
  const [handle, setHandle] = React.useState("")
  const [ageConfirmed, setAgeConfirmed] = React.useState(false)
  const [termsConfirmed, setTermsConfirmed] = React.useState(false)

  const avail = useHandleAvailability(handle)
  const trimmedHandle = handle.trim()
  const handleValid = isValidHandle(trimmedHandle)
  const available = handleValid && avail.data?.available === true
  const displayName = `${first.trim()} ${last.trim()}`.trim()
  const canSubmit =
    available && displayName.length > 0 && ageConfirmed && termsConfirmed && !update.isPending

  const onSubmit = React.useCallback(() => {
    if (!canSubmit) return
    update.mutate({ handle: trimmedHandle, displayName })
  }, [canSubmit, update, trimmedHandle, displayName])

  const previewName = trimmedHandle || displayName || "?"

  const vvShift = useVisualViewportShift()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "var(--scrim)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--card)",
          borderRadius: 24,
          padding: 24,
          boxShadow: "var(--shadow-4), var(--sheen-top)",
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          transform: vvShift ? `translateY(${vvShift}px)` : undefined,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <Avatar name={previewName} seed={user.id} photoUrl={user.avatarUrl} size={72} />
          <h2 id="first-run-title" style={{ marginTop: 14, fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>
            {t("title")}
          </h2>
          <p className="help" style={{ marginTop: 4, maxWidth: 320 }}>
            {t("subtitle")}
          </p>
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="cf-host-row">
            <div className="field">
              <label className="input-label" htmlFor="fr-first">{t("first_name_label")}</label>
              <input
                id="fr-first"
                className="input"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                maxLength={40}
                autoComplete="given-name"
                placeholder={t("first_name_placeholder")}
              />
            </div>
            <div className="field">
              <label className="input-label" htmlFor="fr-last">{t("last_name_label")}</label>
              <input
                id="fr-last"
                className="input"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                maxLength={40}
                autoComplete="family-name"
                placeholder={t("last_name_placeholder")}
              />
            </div>
          </div>

          <div className="field">
            <label className="input-label" htmlFor="fr-handle">{t("username_label")}</label>
            <input
              id="fr-handle"
              className="input"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/^@+/, ""))}
              maxLength={20}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("username_placeholder")}
              aria-describedby="fr-handle-hint"
            />
            <p id="fr-handle-hint" className="help" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <HandleHint
                handle={trimmedHandle}
                valid={handleValid}
                checking={handleValid && avail.isFetching}
                available={available}
                taken={handleValid && avail.data?.available === false}
              />
            </p>
          </div>

          <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <AgeConfirmation confirmed={ageConfirmed} onConfirmedChange={setAgeConfirmed} />
            <TermsConfirmation confirmed={termsConfirmed} onConfirmedChange={setTermsConfirmed} />
          </div>

          {update.isError && (
            <p role="alert" className="cf-clean-error" style={{ marginBottom: 8 }}>
              {errorMessage(update.error, {
                VALIDATION: t("error.validation"),
                CONFLICT: t("error.conflict"),
              }, { fallback: t("error.fallback") })}
            </p>
          )}

          <button
            type="button"
            className="btn primary block lg"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {update.isPending ? (
              <>
                <Loader2 width={16} height={16} className="cf-spin" aria-hidden="true" /> {t("saving")}
              </>
            ) : (
              t("continue")
            )}
          </button>

          <div className="help" style={{ textAlign: "center", marginTop: 12 }}>
            {t("not_you")}{" "}
            <button
              type="button"
              onClick={() => void logout()}
              style={{ color: "var(--bloom)", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {t("sign_out")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function HandleHint({
  handle,
  valid,
  checking,
  available,
  taken,
}: {
  handle: string
  valid: boolean
  checking: boolean
  available: boolean
  taken: boolean
}) {
  const { t } = useT("web-registration")
  if (!handle) return <>{t("handle.rule")}</>
  if (!valid) return <span style={{ color: "var(--bloom)" }}>{t("handle.invalid")}</span>
  if (checking) return (<><Loader2 width={13} height={13} className="cf-spin" aria-hidden="true" /> {t("handle.checking")}</>)
  if (available) return (<span style={{ color: "var(--moss-700)", display: "inline-flex", alignItems: "center", gap: 6 }}><Check width={13} height={13} aria-hidden="true" /> {t("handle.available", { handle })}</span>)
  if (taken) return (<span style={{ color: "var(--bloom)", display: "inline-flex", alignItems: "center", gap: 6 }}><X width={13} height={13} aria-hidden="true" /> {t("handle.taken", { handle })}</span>)
  return <>{t("handle.rule")}</>
}
