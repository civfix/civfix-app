import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"
import { OrgDonationAgreementBody } from "@/components/legal/org-donation-agreement-body"

export const metadata: Metadata = {
  title: "Organization Donation Agreement · civfix",
  description:
    "The agreement between civfix and an organization that raises donations through the platform: eligibility, fees, receipts, refunds, records and termination.",
  robots: { index: true, follow: true },
}

export default function OrgDonationAgreementPage() {
  return (
    <LegalPage
      active="org-donation-agreement"
      title="Organization Donation Agreement"
      intro="The agreement every organization accepts before it can raise donations on civfix"
    >
      <OrgDonationAgreementBody />
    </LegalPage>
  )
}
