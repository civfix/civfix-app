"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldCheck, CheckCircle2, MapPin, Loader2, ArrowRight } from "lucide-react"
import { ErrorCode, type ReportDTO } from "@civfix/shared"

import { useT } from "@civfix/ui/i18n"

import { DetailShell } from "@/components/detail-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusBadge } from "@civfix/ui"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, toAppError } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { useIsAuthenticated } from "@/hooks/use-auth"
import { useUiStore } from "@/store/ui-store"
import { readClaimHandoff, clearClaimHandoff, saveClaimHandoff } from "@/store/claim-handoff"
import { createClaimGate, runGuardedClaim, type ClaimGate } from "@/features/claim/claim-run"

type Phase = "intro" | "claiming" | "done" | "error"

/**
 * /claim - link an anonymously-submitted report to the signed-in account.
 *
 * Source of the claim code, in order: the `code` query param (from the PostDrop nudge link), then the
 * localStorage handoff saved at submit time, then GET /claim/nudge (the server's pending claim when
 * the code is implicit / cookie-bound). If still missing, we show a "nothing to claim" state.
 *
 * Flow:
 *   - Signed out: show the value prop and open the auth modal (Google / Apple / email OTP). We watch
 *     auth state and proceed automatically once the user signs in.
 *   - Signed in: POST /claim/report { claimCode }, then show the now-linked ReportDTO with links to
 *     its pin and to the home "Your reports".
 *
 * Invalid / expired codes surface a clear error with a retry path. All network steps are best-effort
 * and degrade gracefully offline.
 */
/** One claim gate per mounted page, created lazily (a ref, so it survives every re-render). */
function useClaimGate(): ClaimGate {
  const ref = React.useRef<ClaimGate | null>(null)
  if (ref.current === null) ref.current = createClaimGate()
  return ref.current
}

export function ClaimView() {
  const { t } = useT("web-claims")
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAuthenticated = useIsAuthenticated()
  const openAuthModal = useUiStore((s) => s.openAuthModal)

  const queryCode = searchParams.get("code")?.trim() || null
  const queryReport = searchParams.get("report")?.trim() || null

  const [claimCode, setClaimCode] = React.useState<string | null>(queryCode)
  const [phase, setPhase] = React.useState<Phase>("intro")
  const [report, setReport] = React.useState<ReportDTO | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [nudgeFailed, setNudgeFailed] = React.useState(false)
  const [nudgeAttempt, setNudgeAttempt] = React.useState(0)
  // Guard so the auto-claim effect runs the POST at most once.
  const claimAttempted = React.useRef(false)
  // Sequences the claim POSTs so only the LATEST attempt may write the page state (see claim-run.ts).
  const claimGate = useClaimGate()

  // Track a LATER change to ?code= (an in-app navigation from a notification carrying a different
  // code): the state above only seeds the first value, so without this the page would keep claiming the
  // previous report. Re-arm the auto-claim guard so the new code is actually attempted - and ABANDON any
  // claim still in flight for the old code, otherwise it resolves into this reset and forces phase
  // "done" (announcing the OLD report as linked, wiping the handoff, and leaving the new code, whose
  // auto-claim needs phase "intro", never attempted).
  React.useEffect(() => {
    if (queryCode && queryCode !== claimCode) {
      claimGate.abandon()
      setClaimCode(queryCode)
      claimAttempted.current = false
      setPhase("intro")
    }
  }, [queryCode, claimCode, claimGate])

  // Resolve the claim code from the handoff / nudge when not provided in the URL.
  React.useEffect(() => {
    if (claimCode) {
      // If we also have a report id from the URL or handoff, keep the handoff fresh for retries.
      if (queryReport) saveClaimHandoff({ reportId: queryReport, claimCode })
      return
    }
    const handoff = readClaimHandoff()
    if (handoff) {
      setClaimCode(handoff.claimCode)
      return
    }
    // Implicit: ask the server for a pending claim bound to this session/cookie.
    let cancelled = false
    api
      .claimNudge({})
      .then((res) => {
        if (cancelled) return
        setClaimCode(res.claimCode)
        saveClaimHandoff({ reportId: res.reportId, claimCode: res.claimCode })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // NOT_FOUND is the server's "no pending claim" answer and leaves the "nothing to claim" state;
        // anything else (offline, 5xx, rate limit) is unknown, so offer a retry instead.
        if (toAppError(err).code !== ErrorCode.NOT_FOUND) setNudgeFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [claimCode, queryReport, nudgeAttempt])

  const runClaim = React.useCallback(async () => {
    if (!claimCode) return
    await runGuardedClaim({
      claimCode,
      gate: claimGate,
      claim: (code) => api.claimReport({ claimCode: code }),
      onStart: () => {
        setPhase("claiming")
        setError(null)
      },
      onClaimed: (_res, code) => {
        // Runs even if a newer ?code= superseded this attempt: the report IS linked, so its handoff is
        // spent. Scoped to the code we claimed so we never wipe a newer code's fresh handoff.
        if (readClaimHandoff()?.claimCode === code) clearClaimHandoff()
      },
      onSuccess: (res) => {
        setReport(res.report)
        setPhase("done")
      },
      onError: (err) => {
        setError(claimErrorMessage(err, t))
        setPhase("error")
      },
    })
  }, [claimCode, claimGate, t])

  // Auto-run the claim once the user is authenticated and we have a code.
  React.useEffect(() => {
    if (isAuthenticated && claimCode && !claimAttempted.current && phase === "intro") {
      claimAttempted.current = true
      void runClaim()
    }
  }, [isAuthenticated, claimCode, phase, runClaim])

  return (
    <DetailShell backLabel={t("backToMap")}>
      {phase === "done" && report ? (
        <ClaimedReport report={report} />
      ) : phase === "claiming" ? (
        <ClaimingState />
      ) : phase === "error" ? (
        <ErrorState
          message={error ?? t("error.generic")}
          onRetry={() => {
            claimAttempted.current = false
            setPhase("intro")
            if (isAuthenticated) {
              claimAttempted.current = true
              void runClaim()
            } else {
              openAuthModal()
            }
          }}
        />
      ) : nudgeFailed && !claimCode ? (
        <ErrorState
          title={t("lookup_failed.title")}
          message={t("lookup_failed.body")}
          onRetry={() => {
            setNudgeFailed(false)
            setNudgeAttempt((n) => n + 1)
          }}
        />
      ) : (
        <Intro
          hasCode={Boolean(claimCode)}
          isAuthenticated={isAuthenticated}
          onSignIn={openAuthModal}
          onBrowse={() => router.push("/")}
        />
      )}
    </DetailShell>
  )
}

function Intro({
  hasCode,
  isAuthenticated,
  onSignIn,
  onBrowse,
}: {
  hasCode: boolean
  isAuthenticated: boolean
  onSignIn: () => void
  onBrowse: () => void
}) {
  const { t } = useT("web-claims")
  if (!hasCode) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-6 w-6" aria-hidden="true" />}
        title={t("empty.title")}
        titleAs="h1"
        body={t("empty.body")}
        action={
          <Button variant="outline" onClick={onBrowse}>
            {t("empty.action")}
          </Button>
        }
      />
    )
  }

  return (
    <div className="text-center">
      <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-pill bg-bloom-50 text-primary">
        <ShieldCheck className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="font-display text-token-30 font-extrabold text-ink">{t("intro.title")}</h1>
      <p className="mx-auto mt-2 max-w-md text-token-15 text-ink-2">{t("intro.body")}</p>

      <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left">
        <ValueItem>{t("intro.value.status")}</ValueItem>
        <ValueItem>{t("intro.value.notified")}</ValueItem>
        <ValueItem>{t("intro.value.onePlace")}</ValueItem>
      </ul>

      <div className="mt-6 flex justify-center">
        {isAuthenticated ? (
          <p className="inline-flex items-center gap-2 text-token-14 text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("linking")}
          </p>
        ) : (
          <Button size="lg" onClick={onSignIn}>
            {t("intro.signIn")}
          </Button>
        )}
      </div>
    </div>
  )
}

function ValueItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-token-14 text-ink-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-moss-600" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

function ClaimedReport({ report }: { report: ReportDTO }) {
  const { t } = useT("web-claims")
  const router = useRouter()
  const title = report.title?.trim() || t(`enums:category.${report.category}`)
  const place = report.addr?.trim()

  return (
    <div>
      <div className="text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-pill bg-moss-100 text-moss-600">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="font-display text-token-30 font-extrabold text-ink">{t("linked.title")}</h1>
        <p className="mt-1.5 text-token-15 text-ink-3">{t("linked.body")}</p>
      </div>

      {/* Linked report card */}
      <div className="mt-6 rounded-lg border border-ink-5 bg-cardflat p-4 shadow-s1">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-display text-token-18 font-bold text-ink">{title}</span>
          <StatusBadge status={report.status} />
        </div>
        {place && (
          <p className="mt-1 flex items-center gap-1.5 text-token-13 text-ink-3">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {place}
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        <Button onClick={() => router.push(`/pin/${report.id}`)}>
          {t("linked.viewReport")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button variant="outline" onClick={() => router.push("/reports")}>
          {t("linked.yourReports")}
        </Button>
      </div>
    </div>
  )
}

function ClaimingState() {
  const { t } = useT("web-claims")
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-3 text-token-15 text-ink-2">{t("linking")}</p>
      <Skeleton className="mt-6 h-20 w-full max-w-sm rounded-lg" />
    </div>
  )
}

function ErrorState({
  title,
  message,
  onRetry,
}: {
  title?: string
  message: string
  onRetry: () => void
}) {
  const { t } = useT("web-claims")
  return (
    <EmptyState
      title={title ?? t("error.title")}
      titleAs="h1"
      body={message}
      action={
        <Button variant="outline" onClick={onRetry}>
          {t("error.retry")}
        </Button>
      }
    />
  )
}

/**
 * Friendly copy for claim errors a user can act on.
 *
 * Maps server error CODES → localized client strings (per i18n spec §6) while keeping
 * `errorMessage`'s public API intact. The caller (a component) supplies the bound `t`.
 */
function claimErrorMessage(err: unknown, t: (key: string) => string): string {
  return errorMessage(
    err,
    {
      NOT_FOUND: t("error.code.notFound"),
      VALIDATION: t("error.code.validation"),
      CONFLICT: t("error.code.conflict"),
      UNAUTHORIZED: t("error.code.unauthorized"),
    },
    { fallback: t("error.code.fallback") },
  )
}
