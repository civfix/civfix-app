"use client"

import type { OrgEligibilityDTO } from "@civfix/shared"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"
import { useConsoleFormat } from "../../format"

const VERDICT_CLASSES = {
  eligible: "bg-console-moss-soft text-console-moss-strong",
  grace: "bg-console-sun-soft text-console-sun-strong",
  review_required: "bg-console-sun-soft text-console-sun-strong",
  ineligible: "bg-console-bloom-soft text-console-bloom-strong",
  unknown: "bg-console-surface-alt text-console-ink-2",
} as const

export function EligibilityCard({ eligibility }: { eligibility: OrgEligibilityDTO }) {
  const { t } = useT("host-payments")
  const format = useConsoleFormat()

  return (
    <section
      aria-labelledby="eligibility-heading"
      className="rounded-md border border-console-line bg-console-surface p-token-4 shadow-console-1"
    >
      <div className="mb-token-3 flex flex-wrap items-center justify-between gap-token-2">
        <h2
          id="eligibility-heading"
          className="font-display text-token-16 font-bold text-console-ink"
        >
          {t("eligibility.title")}
        </h2>
        <span
          className={cn(
            "inline-flex items-center rounded-pill px-token-3 py-0.5 text-token-12 font-bold",
            VERDICT_CLASSES[eligibility.verdict],
          )}
        >
          {t(`eligibility.verdict_${eligibility.verdict}`)}
        </span>
      </div>

      <dl className="grid gap-token-3 sm:grid-cols-2">
        <div>
          <dt className="text-token-12 text-console-ink-3">{t("eligibility.legal_name")}</dt>
          <dd className="text-token-13 text-console-ink">{eligibility.irsLegalName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-token-12 text-console-ink-3">{t("eligibility.ein")}</dt>
          <dd className="text-token-13 text-console-ink">
            {eligibility.einLast4 ? `••• ${eligibility.einLast4}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-token-12 text-console-ink-3">{t("eligibility.deductibility")}</dt>
          <dd className="text-token-13 text-console-ink">
            {eligibility.deductibilityCode ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-token-12 text-console-ink-3">{t("eligibility.evaluated_at")}</dt>
          <dd className="text-token-13 text-console-ink">
            {eligibility.evaluatedAt ? format.dateTime(eligibility.evaluatedAt) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-token-12 text-console-ink-3">{t("eligibility.next_check")}</dt>
          <dd className="text-token-13 text-console-ink">
            {eligibility.nextCheckAt ? format.date(eligibility.nextCheckAt) : "—"}
          </dd>
        </div>
        {eligibility.graceExpiresAt ? (
          <div>
            <dt className="text-token-12 text-console-ink-3">{t("eligibility.grace_expires")}</dt>
            <dd className="text-token-13 font-semibold text-console-sun-strong">
              {format.date(eligibility.graceExpiresAt)}
            </dd>
          </div>
        ) : null}
      </dl>

      {eligibility.reasons.length > 0 ? (
        <div className="mt-token-4">
          <h3 className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
            {t("eligibility.reasons")}
          </h3>
          <ul className="flex list-disc flex-col gap-token-1 pl-token-5 text-token-13 text-console-ink-2">
            {eligibility.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {eligibility.checks.length > 0 ? (
        <div className="mt-token-4">
          <h3 className="mb-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3">
            {t("eligibility.evidence")}
          </h3>
          <ul className="flex flex-col divide-y divide-console-line">
            {eligibility.checks.map((check, index) => (
              <li
                key={`${check.source}:${index}`}
                className="flex flex-wrap items-baseline gap-token-2 py-token-2 text-token-12"
              >
                <span className="font-semibold text-console-ink">
                  {t(`eligibility.source_${check.source}`)}
                </span>
                <span className="text-console-ink-3">
                  {t("eligibility.revision", { revision: check.sourceRevisionDate })}
                </span>
                <span className="text-console-ink-2">
                  {t(`eligibility.contribution_${check.verdictContribution}`)}
                </span>
                {check.detail ? <span className="text-console-ink-3">{check.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {eligibility.verdict !== "eligible" ? (
        <p className="mt-token-4 rounded-sm border border-console-sun-strong/40 bg-console-sun-soft px-token-3 py-token-2 text-token-13 text-console-sun-strong">
          {t(`eligibility.remediation_${eligibility.verdict}`)}
        </p>
      ) : null}
    </section>
  )
}
