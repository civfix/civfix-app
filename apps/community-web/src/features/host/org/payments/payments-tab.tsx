"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { OrgDonationSettingsDTO, OrgPaymentsStatusDTO } from "@civfix/shared"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useGate } from "@/components/console/query-state"
import { LoadingState, NoAccessState, StateGate } from "@/components/console/states"

import { consoleKeys } from "../../console-keys"
import { ConnectStatusCard } from "./connect-status-card"
import { EligibilityCard } from "./eligibility-card"
import { ConsentAgreementFlow } from "./consent-agreement-flow"
import { DonationSettingsForm } from "./donation-settings-form"
import { DonationsReport } from "./donations-report"
import { DonationExports } from "./donation-exports"

export interface PaymentsTabProps {
  orgId: string
  orgName: string
  canManagePayments: boolean
  canViewDonations: boolean
}

export function PaymentsTab({
  orgId,
  orgName,
  canManagePayments,
  canViewDonations,
}: PaymentsTabProps) {
  const { t } = useT("host-payments")
  const api = useApi()
  const [agreementOpen, setAgreementOpen] = useState(false)

  const status = useQuery<OrgPaymentsStatusDTO>({
    queryKey: consoleKeys.orgPayments(orgId),
    enabled: canViewDonations,
    queryFn: () => api.getOrgPaymentsStatus({ id: orgId }),
    retry: false,
  })
  const settings = useQuery<OrgDonationSettingsDTO>({
    queryKey: consoleKeys.orgDonationSettings(orgId),
    enabled: canViewDonations,
    queryFn: () => api.getOrgDonationSettings({ id: orgId }),
    retry: false,
  })

  const statusGate = useGate(status)
  const settingsGate = useGate(settings)

  if (!canViewDonations) {
    return <NoAccessState title={t("no_access_title")} body={t("no_access_body")} />
  }

  return (
    <div className="flex flex-col gap-token-5">
      <StateGate
        {...statusGate}
        onRetry={() => void status.refetch()}
        skeleton={<LoadingState shape="card" count={2} />}
      >
        {status.data ? (
          <>
            <ConnectStatusCard
              orgId={orgId}
              status={status.data}
              canManage={canManagePayments}
              agreementCurrent={status.data.agreement.current}
              onOpenAgreement={() => setAgreementOpen(true)}
            />
            <EligibilityCard eligibility={status.data.eligibility} />
          </>
        ) : null}
      </StateGate>

      <StateGate
        {...settingsGate}
        onRetry={() => void settings.refetch()}
        skeleton={<LoadingState shape="card" count={1} />}
      >
        {settings.data && status.data ? (
          <DonationSettingsForm
            orgId={orgId}
            settings={settings.data}
            status={status.data}
            canManage={canManagePayments}
            onOpenAgreement={() => setAgreementOpen(true)}
          />
        ) : null}
      </StateGate>

      <DonationsReport orgId={orgId} orgName={orgName} canView={canViewDonations} />

      <DonationExports orgId={orgId} canView={canViewDonations} />

      {status.data ? (
        <ConsentAgreementFlow
          orgId={orgId}
          agreement={status.data.agreement}
          open={agreementOpen}
          canManage={canManagePayments}
          onClose={() => setAgreementOpen(false)}
        />
      ) : null}
    </div>
  )
}
