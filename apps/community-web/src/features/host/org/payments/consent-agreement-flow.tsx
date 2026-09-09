"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { GetLegalVersionsResponse, OrgDonationAgreementDTO } from "@civfix/shared"
import { legalDocument } from "@civfix/shared/legal"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { GuidedSheet } from "@/components/console/overlay/guided-sheet"
import { OrgDonationAgreementBody } from "@/components/legal/org-donation-agreement-body"
import { useConsoleToast } from "@/components/console/overlay/toast"
import { ConsoleButton } from "@/components/console/button"

import { consoleKeys } from "../../console-keys"
import { useConsoleErrors } from "../../error-copy"
import { useConsoleFormat } from "../../format"

const AGREEMENT_DOCUMENT = "org_donation_agreement"
const UI_TEMPLATE_VERSION = "console-payments-2"
const AGREEMENT_PATH = "/legal/org-donation-agreement"

const AGREEMENT_PROSE = [
  "max-h-[46vh] overflow-y-auto overscroll-contain rounded-sm border border-console-line bg-console-tint px-token-4 py-token-3",
  "text-token-13 leading-relaxed text-console-ink-2",
  "[&_h2]:mb-token-2 [&_h2]:mt-token-4 [&_h2]:text-token-14 [&_h2]:font-bold [&_h2]:text-console-ink",
  "[&_section:first-child_h2]:mt-0",
  "[&_p]:mb-token-2 [&_ul]:mb-token-2 [&_ul]:list-disc [&_ul]:pl-token-5 [&_li]:mb-token-1",
  "[&_strong]:font-bold [&_strong]:text-console-ink",
  "[&_a]:font-semibold [&_a]:text-console-sky-strong [&_a]:underline [&_a]:underline-offset-2",
  "[&_.legal-note]:rounded-xs [&_.legal-note]:bg-console-surface [&_.legal-note]:px-token-3 [&_.legal-note]:py-token-2",
].join(" ")

export interface ConsentAgreementFlowProps {
  orgId: string
  agreement: OrgDonationAgreementDTO
  open: boolean
  canManage: boolean
  onClose: () => void
}

export function ConsentAgreementFlow({
  orgId,
  agreement,
  open,
  canManage,
  onClose,
}: ConsentAgreementFlowProps) {
  const { t } = useT("host-payments")
  const api = useApi()
  const qc = useQueryClient()
  const toast = useConsoleToast()
  const errors = useConsoleErrors()
  const format = useConsoleFormat()

  const [accepted, setAccepted] = useState(false)
  const [authority, setAuthority] = useState(false)

  const versions = useQuery<GetLegalVersionsResponse>({
    queryKey: ["legal", "versions"],
    enabled: open,
    queryFn: () => api.getLegalVersions({}),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const shownDoc = legalDocument(AGREEMENT_DOCUMENT)
  const serverDoc = versions.data?.documents.find((entry) => entry.type === AGREEMENT_DOCUMENT)
  const agreementHref = AGREEMENT_PATH
  const requiredVersion = agreement.requiredVersion ?? serverDoc?.version ?? null
  const staleBuild = requiredVersion !== null && requiredVersion !== shownDoc.version

  const accept = useMutation({
    mutationFn: () =>
      api.acceptOrgDonationAgreement({
        id: orgId,
        version: shownDoc.version,
        documentSha256: shownDoc.sha256,
        surface: "web_org_settings",
        screenRoute: `/manage/orgs/${orgId}/payments`,
        uiTemplateVersion: UI_TEMPLATE_VERSION,
        authorityAffirmed: true,
      }),
    onSuccess: () => {
      toast.toast({ title: t("agreement.accepted"), tone: "success" })
      setAccepted(false)
      setAuthority(false)
      void qc.invalidateQueries({ queryKey: consoleKeys.orgPayments(orgId) })
      void qc.invalidateQueries({ queryKey: consoleKeys.orgDonationSettings(orgId) })
      onClose()
    },
    onError: (err) => {
      toast.toast({
        title: errors.message(err, { CONFLICT: t("agreement.drift") }),
        tone: "danger",
      })
      void versions.refetch()
      void qc.invalidateQueries({ queryKey: consoleKeys.orgPayments(orgId) })
    },
  })

  return (
    <GuidedSheet
      open={open}
      onClose={onClose}
      title={t("agreement.title")}
      primaryLabel={t("agreement.accept")}
      primaryDisabled={
        !canManage || !accepted || !authority || requiredVersion === null || staleBuild || accept.isPending
      }
      onPrimary={() => accept.mutate()}
      secondary={
        <ConsoleButton variant="ghost" size="sm" onClick={onClose}>
          {t("agreement.close")}
        </ConsoleButton>
      }
      sections={[
        {
          id: "who",
          title: t("agreement.section_who"),
          content: <p>{t("agreement.body_who")}</p>,
        },
        {
          id: "fees",
          title: t("agreement.section_fees"),
          content: <p>{t("agreement.body_fees")}</p>,
        },
        {
          id: "duties",
          title: t("agreement.section_duties"),
          content: <p>{t("agreement.body_duties")}</p>,
        },
      ]}
      notice={
        <div className="flex flex-col gap-token-2 text-token-13 text-console-ink-2">
          <p>
            {requiredVersion
              ? t("agreement.version", { version: requiredVersion })
              : t("agreement.version_unknown")}
          </p>
          <a
            href={agreementHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xs font-semibold text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
          >
            {t("agreement.read_full")}
          </a>
          {staleBuild ? (
            <p role="alert" className="text-token-12 text-console-sun-strong">
              {t("agreement.drift")}
            </p>
          ) : null}
          {agreement.acceptedAt ? (
            <p className="text-token-12 text-console-ink-3">
              {t("agreement.history", {
                version: agreement.version ?? "—",
                when: format.dateTime(agreement.acceptedAt),
                who: agreement.acceptedByName ?? "—",
              })}
            </p>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-token-3">
        <div
          tabIndex={0}
          role="region"
          aria-label={t("agreement.title")}
          className={AGREEMENT_PROSE}
        >
          <OrgDonationAgreementBody />
        </div>
        <label className="flex cursor-pointer items-start gap-token-2 rounded-sm border border-console-line bg-console-tint p-token-3">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-console-accent"
          />
          <span className="text-token-13 text-console-ink-2">{t("agreement.check_accept")}</span>
        </label>
        <label className="flex cursor-pointer items-start gap-token-2 rounded-sm border border-console-line bg-console-tint p-token-3">
          <input
            type="checkbox"
            checked={authority}
            onChange={(event) => setAuthority(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-console-accent"
          />
          <span className="text-token-13 text-console-ink-2">{t("agreement.check_authority")}</span>
        </label>
        {!canManage ? (
          <p className="text-token-12 text-console-sun-strong">{t("agreement.owner_only")}</p>
        ) : null}
      </div>
    </GuidedSheet>
  )
}
