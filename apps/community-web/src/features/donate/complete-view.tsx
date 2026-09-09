"use client"

import * as React from "react"
import { CheckCircle2, CircleAlert, Loader2, Printer } from "lucide-react"
import { ErrorCode, type GetDonationStatusResponse } from "@civfix/shared"

import { api, toAppError } from "@/lib/api"
import { formatMinor } from "./donate-amount"
import { pollDecision } from "./donate-status-poll"
import { parseCompleteParams, statusTokenStorageKey } from "./donate-route"

type Phase =
  | { readonly kind: "unaddressed" }
  | { readonly kind: "polling"; readonly status: GetDonationStatusResponse | null }
  | { readonly kind: "settled"; readonly status: GetDonationStatusResponse }
  | { readonly kind: "slow"; readonly status: GetDonationStatusResponse | null }
  | { readonly kind: "unreadable" }

function readStoredToken(donationId: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage.getItem(statusTokenStorageKey(donationId))
  } catch {
    return null
  }
}

export function rememberStatusToken(donationId: string, token: string): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(statusTokenStorageKey(donationId), token)
  } catch {
    return
  }
}

const CHARGED_AT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

function formatChargedAt(value: string | null): string | null {
  if (value === null) return null
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : CHARGED_AT.format(at)
}

export function CompleteView() {
  const [phase, setPhase] = React.useState<Phase>({ kind: "polling", status: null })

  React.useEffect(() => {
    const params = parseCompleteParams(window.location.search)
    if (params.donationId === null) {
      setPhase({ kind: "unaddressed" })
      return
    }
    const token = params.statusToken ?? readStoredToken(params.donationId)
    if (params.statusToken !== null) rememberStatusToken(params.donationId, params.statusToken)

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const run = async (attempt: number, elapsedMs: number): Promise<void> => {
      let status: GetDonationStatusResponse | null = null
      try {
        status = await api.getDonationStatus({
          id: params.donationId as string,
          ...(token ? { token } : {}),
          ...(params.sessionId ? { sessionId: params.sessionId } : {}),
        })
      } catch (error) {
        if (cancelled) return
        const code = toAppError(error).code
        if (
          code === ErrorCode.NOT_FOUND ||
          code === ErrorCode.FORBIDDEN ||
          code === ErrorCode.UNAUTHORIZED
        ) {
          setPhase({ kind: "unreadable" })
          return
        }
      }
      if (cancelled) return
      if (status !== null) setPhase({ kind: "polling", status })

      const decision = pollDecision(status?.status ?? null, attempt, elapsedMs)
      if (decision.kind === "stop") {
        if (decision.reason === "settled" && status !== null) setPhase({ kind: "settled", status })
        else setPhase({ kind: "slow", status })
        return
      }
      timer = setTimeout(() => {
        void run(attempt + 1, elapsedMs + decision.delayMs)
      }, decision.delayMs)
    }

    void run(0, 0)

    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [])

  if (phase.kind === "unaddressed") {
    return (
      <CompleteShell title="Nothing to show here">
        <p>
          This page confirms a donation you have just made. Open it from the link you were returned to
          after paying, or check your email for the receipt.
        </p>
      </CompleteShell>
    )
  }

  if (phase.kind === "unreadable") {
    return (
      <CompleteShell title="We can&rsquo;t show this donation">
        <p>
          This confirmation link is no longer valid. If your payment went through you will still get a
          receipt by email; nothing about your donation depends on this page.
        </p>
      </CompleteShell>
    )
  }

  const status = phase.kind === "settled" ? phase.status : phase.status
  const chargedAt = formatChargedAt(status?.chargedAt ?? null)

  if (phase.kind === "settled" && status !== null && status.status === "succeeded") {
    return (
      <CompleteShell title="Thank you" icon="success">
        <p className="donate-complete-lead">
          Your donation of <strong>{formatMinor(status.amount.amountMinor)}</strong> to{" "}
          <strong>{status.orgLegalName}</strong> went through.
        </p>
        <dl className="donate-complete-facts">
          <div>
            <dt>Reference</dt>
            <dd>{status.reference}</dd>
          </div>
          {chargedAt === null ? null : (
            <div>
              <dt>Charged</dt>
              <dd>{chargedAt}</dd>
            </div>
          )}
          {status.maskedEmail === null ? null : (
            <div>
              <dt>Receipt sent to</dt>
              <dd>{status.maskedEmail}</dd>
            </div>
          )}
        </dl>
        <p>
          {status.receiptSent
            ? "Your receipt is on its way to that address."
            : "Your receipt will arrive by email shortly."}{" "}
          Keep it: for a donation of $250 or more you need it to claim a deduction.
        </p>
        <div className="donate-complete-actions">
          <button type="button" className="donate-secondary" onClick={() => window.print()}>
            <Printer aria-hidden="true" size={16} /> Print this page
          </button>
        </div>
        <p className="donate-field-hint">You can close this window.</p>
      </CompleteShell>
    )
  }

  if (phase.kind === "settled" && status !== null && status.status === "failed") {
    return (
      <CompleteShell title="That payment didn&rsquo;t go through" icon="alert">
        <p>
          Your card was not charged. Nothing was sent to {status.orgLegalName}. You can try again from
          the donation page.
        </p>
      </CompleteShell>
    )
  }

  if (phase.kind === "settled" && status !== null) {
    return (
      <CompleteShell title="Donation update" icon="alert">
        <p>
          Your donation of {formatMinor(status.amount.amountMinor)} to {status.orgLegalName} is marked{" "}
          <strong>{status.status.replace(/_/g, " ")}</strong>. Reference {status.reference}.
        </p>
      </CompleteShell>
    )
  }

  if (phase.kind === "slow") {
    return (
      <CompleteShell title="Still processing" icon="pending">
        <p>
          Your payment is taking longer than usual to settle. You do not need to wait here or pay again
          &mdash; we will email your receipt as soon as it completes.
        </p>
      </CompleteShell>
    )
  }

  return (
    <CompleteShell title="Confirming your donation" icon="pending">
      <p>Checking with the payment processor. This usually takes a few seconds.</p>
    </CompleteShell>
  )
}

interface CompleteShellProps {
  title: string
  icon?: "success" | "alert" | "pending"
  children: React.ReactNode
}

function CompleteShell({ title, icon, children }: CompleteShellProps) {
  return (
    <main className="donate-page donate-complete" aria-live="polite">
      <div className="donate-shell">
        <div className="donate-complete-icon" data-icon={icon ?? "none"}>
          {icon === "success" ? <CheckCircle2 aria-hidden="true" size={40} /> : null}
          {icon === "alert" ? <CircleAlert aria-hidden="true" size={40} /> : null}
          {icon === "pending" ? (
            <Loader2 aria-hidden="true" className="donate-spin" size={40} />
          ) : null}
        </div>
        <h1>{title}</h1>
        {children}
        <p className="donate-complete-links">
          <a href="/legal/donations">How donations through civfix work</a> ·{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Back to civfix</a>
        </p>
      </div>
    </main>
  )
}
