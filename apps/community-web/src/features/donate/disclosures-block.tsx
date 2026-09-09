"use client"

import * as React from "react"
import { isSafeMarkdownHref } from "@civfix/shared/markdown"
import type { DonationDisclosures, DonationTaxDeductibility } from "@civfix/shared"

export const DISCLOSURE_IDS = [
  "recipient",
  "may-not-receive",
  "remittance-timing",
  "fee-pointer",
  "deductibility",
  "merchant-of-record",
  "refund-policy",
] as const

export type DisclosureId = (typeof DISCLOSURE_IDS)[number]

export const MAY_NOT_RECEIVE_FALLBACK_URL = "/legal/donations#may-not-receive"

const CHECKED_DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
})

export function safeMayNotReceiveUrl(value: string | null | undefined): string {
  if (typeof value !== "string" || value.length === 0) return MAY_NOT_RECEIVE_FALLBACK_URL
  if (value.startsWith("/") && !value.startsWith("//")) return value
  return isSafeMarkdownHref(value) ? value : MAY_NOT_RECEIVE_FALLBACK_URL
}

function formatCheckedAt(value: string | null | undefined): string | null {
  if (!value) return null
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : CHECKED_DATE.format(at)
}

interface DisclosuresBlockProps {
  disclosures: DonationDisclosures
  taxDeductibility: DonationTaxDeductibility
  disclosureVersion: string
}

export function DisclosuresBlock({
  disclosures,
  taxDeductibility,
  disclosureVersion,
}: DisclosuresBlockProps) {
  const mayNotReceiveUrl = safeMayNotReceiveUrl(disclosures.mayNotReceiveUrl)
  const checkedAt = formatCheckedAt(
    disclosures.deductibilityCheckedAt ?? taxDeductibility.checkedAt ?? null,
  )

  return (
    <section
      className="donate-disclosures"
      aria-labelledby="donate-disclosures-heading"
      data-disclosure-version={disclosureVersion}
    >
      <h2 id="donate-disclosures-heading">Before you donate</h2>

      <p data-disclosure="recipient">{disclosures.recipient}</p>

      <p data-disclosure="may-not-receive">
        {disclosures.mayNotReceive}{" "}
        <a href={mayNotReceiveUrl} rel="noreferrer noopener" target="_blank">
          When an organization may not receive your donation
        </a>
        .
      </p>
      {disclosures.mayNotReceiveReasons.length > 0 ? (
        <ul data-disclosure="may-not-receive-reasons">
          {disclosures.mayNotReceiveReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      <p data-disclosure="remittance-timing">{disclosures.remittanceTiming}</p>

      <p data-disclosure="fee-pointer">{disclosures.feePointer}</p>

      <p data-disclosure="deductibility">
        {disclosures.deductibility}
        {checkedAt === null ? null : ` Verified against IRS records on ${checkedAt}.`}
      </p>

      <p data-disclosure="merchant-of-record">{disclosures.merchantOfRecord}</p>

      <p data-disclosure="refund-policy">{disclosures.refundPolicy}</p>
    </section>
  )
}
