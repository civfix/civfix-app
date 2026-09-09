"use client"

import { useEffect, useRef, useState } from "react"
import { ExternalLink, RefreshCw } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { OrgPaymentsStatusDTO } from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useConsoleUrlState } from "@/components/console/url-state"
import { ConsoleButton } from "@/components/console/button"
import { Chip } from "@/components/console/chips/chip"
import { useConsoleToast } from "@/components/console/overlay/toast"

import { consoleKeys } from "../../console-keys"
import { useConsoleErrors } from "../../error-copy"
import { useConsoleFormat } from "../../format"

const RETURN_POLL_DELAYS_MS = [2000, 4000, 8000, 15000, 30000] as const

export interface ConnectStatusCardProps {
  orgId: string
  status: OrgPaymentsStatusDTO
  canManage: boolean
  agreementCurrent: boolean
  onOpenAgreement: () => void
}

export function ConnectStatusCard({
  orgId,
  status,
  canManage,
  agreementCurrent,
  onOpenAgreement,
}: ConnectStatusCardProps) {
  const { t } = useT("host-payments")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const format = useConsoleFormat()
  const { params, set } = useConsoleUrlState()

  const [awaitingReturn, setAwaitingReturn] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      for (const handle of timers.current) window.clearTimeout(handle)
      timers.current = []
    },
    [],
  )

  useEffect(() => {
    if (params.stripe === "return") {
      setAwaitingReturn(true)
      toast.toast({ title: t("return.toast_title"), description: t("return.toast_body") })
      for (const delay of RETURN_POLL_DELAYS_MS) {
        timers.current.push(
          window.setTimeout(() => {
            void qc.invalidateQueries({ queryKey: consoleKeys.orgPayments(orgId) })
          }, delay),
        )
      }
      set({ stripe: null })
    } else if (params.stripe === "refresh") {
      toast.toast({ title: t("refresh.toast_title"), description: t("refresh.toast_body") })
      set({ stripe: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.stripe])

  useEffect(() => {
    if (awaitingReturn && (status.state === "ready" || status.chargesEnabled)) {
      setAwaitingReturn(false)
    }
  }, [awaitingReturn, status.state, status.chargesEnabled])

  const createAccount = useMutation({
    mutationFn: () => api.createOrgStripeAccount({ id: orgId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: consoleKeys.orgPayments(orgId) })
      link.mutate("onboarding")
    },
    onError: (err) =>
      toast.toast({
        title: errors.message(err, {
          CONFLICT: t("connect.agreement_first"),
          PAYMENT_UNAVAILABLE: t("connect.not_eligible"),
        }),
        tone: "danger",
      }),
  })

  const link = useMutation({
    mutationFn: (type: "onboarding" | "update") =>
      api.createOrgStripeAccountLink({ id: orgId, type }),
    onSuccess: (res) => {
      window.location.assign(res.url)
    },
    onError: (err) => toast.toast({ title: errors.message(err), tone: "danger" }),
  })

  const busy = createAccount.isPending || link.isPending
  const requirements = [
    ...status.pastDue.map((key) => ({ key, tone: "past_due" as const })),
    ...status.currentlyDue.map((key) => ({ key, tone: "currently_due" as const })),
    ...status.pendingVerification.map((key) => ({ key, tone: "pending" as const })),
  ]

  return (
    <section
      aria-labelledby="connect-status"
      className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"
    >
      <div className="mb-token-3 flex flex-wrap items-center justify-between gap-token-2">
        <h2 id="connect-status" className="font-display text-token-16 font-bold text-console-ink">
          {t("connect.title")}
        </h2>
        <div className="flex items-center gap-token-2">
          <Chip kind="org-payments" value={status.state} />
          <Chip kind="donate-state" value={status.donateState} size="sm" />
        </div>
      </div>

      {awaitingReturn ? (
        <p
          role="status"
          className="mb-token-3 flex items-center gap-token-2 rounded-sm border border-console-sky-strong/40 bg-console-sky-soft px-token-3 py-token-2 text-token-13 text-console-sky-strong"
        >
          <RefreshCw aria-hidden className="h-4 w-4 animate-spin" />
          {t("return.pending")}
        </p>
      ) : null}

      <p className="mb-token-3 text-token-13 text-console-ink-2">
        {t(`connect.state_${status.state}`)}
      </p>

      {status.state === "not_started" ? (
        <div className="flex flex-col gap-token-2">
          {!agreementCurrent ? (
            <p className="text-token-13 text-console-sun-strong">
              {t("connect.agreement_required")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-token-2">
            {!agreementCurrent ? (
              <ConsoleButton size="sm" onClick={onOpenAgreement}>
                {t("connect.review_agreement")}
              </ConsoleButton>
            ) : (
              <ConsoleButton
                size="sm"
                disabled={!canManage || busy}
                title={canManage ? undefined : t("connect.owner_only")}
                onClick={() => createAccount.mutate()}
              >
                {t("connect.start")}
              </ConsoleButton>
            )}
          </div>
        </div>
      ) : null}

      {status.state === "onboarding" || status.state === "at_risk" ? (
        <ConsoleButton
          size="sm"
          disabled={!canManage || busy}
          title={canManage ? undefined : t("connect.owner_only")}
          onClick={() => link.mutate(status.state === "onboarding" ? "onboarding" : "update")}
        >
          <ExternalLink aria-hidden className="h-4 w-4" />
          {status.state === "onboarding" ? t("connect.continue") : t("connect.fix")}
        </ConsoleButton>
      ) : null}

      {status.state === "ready" ? (
        <ConsoleButton
          variant="outline"
          size="sm"
          disabled={!canManage || busy}
          title={canManage ? undefined : t("connect.owner_only")}
          onClick={() => link.mutate("update")}
        >
          <ExternalLink aria-hidden className="h-4 w-4" />
          {t("connect.open_dashboard")}
        </ConsoleButton>
      ) : null}

      {status.state === "blocked" ? (
        <p className="rounded-sm border border-console-bloom-strong/40 bg-console-bloom-soft px-token-3 py-token-2 text-token-13 text-console-bloom-strong">
          {status.disabledReason
            ? t("connect.blocked_reason", { reason: status.disabledReason })
            : t("connect.blocked_generic")}
        </p>
      ) : null}

      {requirements.length > 0 ? (
        <div className="mt-token-4">
          <h3 className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
            {t("connect.requirements")}
          </h3>
          <ul className="flex flex-col gap-token-1">
            {requirements.map((item) => (
              <li key={`${item.tone}:${item.key}`} className="text-token-13 text-console-ink-2">
                <span className="font-mono text-token-12 text-console-ink-3">{item.key}</span>
                <span className="ml-token-2">{t(`connect.requirement_${item.tone}`)}</span>
              </li>
            ))}
          </ul>
          {status.currentDeadline ? (
            <p className="mt-token-2 text-token-12 text-console-sun-strong">
              {t("connect.deadline", { when: format.date(status.currentDeadline) })}
            </p>
          ) : null}
        </div>
      ) : null}

      <dl className="mt-token-4 grid grid-cols-2 gap-token-3 text-token-12">
        <div>
          <dt className="text-console-ink-3">{t("connect.charges")}</dt>
          <dd className="text-console-ink">
            {status.chargesEnabled ? t("connect.enabled") : t("connect.disabled")}
          </dd>
        </div>
        <div>
          <dt className="text-console-ink-3">{t("connect.payouts")}</dt>
          <dd className="text-console-ink">
            {status.payoutsEnabled ? t("connect.enabled") : t("connect.disabled")}
          </dd>
        </div>
        <div>
          <dt className="text-console-ink-3">{t("connect.wallets")}</dt>
          <dd className="text-console-ink">
            {status.walletsAvailable.length > 0
              ? status.walletsAvailable.join(", ")
              : t("connect.wallets_none")}
          </dd>
        </div>
        <div>
          <dt className="text-console-ink-3">{t("connect.last_synced")}</dt>
          <dd className="text-console-ink">
            {status.lastSyncedAt ? format.dateTime(status.lastSyncedAt) : t("connect.never")}
          </dd>
        </div>
      </dl>
    </section>
  )
}
