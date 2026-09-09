"use client"

import * as React from "react"
import type { FeeBreakdownDTO } from "@civfix/shared"

import { formatMinor } from "./donate-amount"

interface FeeBreakdownProps {
  breakdown: FeeBreakdownDTO | null
  recipientLegalName: string
  authoritative: boolean
  idPrefix?: string
}

export function FeeBreakdown({
  breakdown,
  recipientLegalName,
  authoritative,
  idPrefix = "donate-fees",
}: FeeBreakdownProps) {
  const headingId = `${idPrefix}-heading`
  if (breakdown === null) {
    return (
      <section className="donate-fees" aria-labelledby={headingId}>
        <h2 id={headingId}>Where your donation goes</h2>
        <p className="donate-fees-empty">Enter an amount to see the breakdown.</p>
      </section>
    )
  }

  const platformPercent = (breakdown.platformFeeBps / 100).toFixed(
    breakdown.platformFeeBps % 100 === 0 ? 0 : 2,
  )

  return (
    <section className="donate-fees" aria-labelledby={headingId}>
      <h2 id={headingId}>Where your donation goes</h2>
      <dl aria-live="polite" aria-atomic="true" data-fees-authoritative={String(authoritative)}>
        <div className="donate-fee-row">
          <dt>Your donation</dt>
          <dd data-fee="gross" data-fee-scope={idPrefix}>{formatMinor(breakdown.grossMinor)}</dd>
        </div>
        <div className="donate-fee-row">
          <dt>
            {breakdown.processorFeeIsEstimate ? "Estimated card processing fee" : "Card processing fee"}{" "}
            <span className="donate-fee-note">(paid by the organization)</span>
          </dt>
          <dd data-fee="processor" data-fee-scope={idPrefix}>&minus;{formatMinor(breakdown.processorFeeMinor)}</dd>
        </div>
        <div className="donate-fee-row">
          <dt>
            civfix platform fee <span className="donate-fee-note">({platformPercent}%)</span>
          </dt>
          <dd data-fee="platform" data-fee-scope={idPrefix}>&minus;{formatMinor(breakdown.platformFeeMinor)}</dd>
        </div>
        <div className="donate-fee-row donate-fee-total">
          <dt>
            {breakdown.processorFeeIsEstimate ? "Estimated amount to" : "Amount to"}{" "}
            {recipientLegalName}
          </dt>
          <dd data-fee="net" data-fee-scope={idPrefix}>{formatMinor(breakdown.netMinor)}</dd>
        </div>
      </dl>
      {breakdown.processorFeeIsEstimate ? (
        <p className="donate-fee-note">
          The card processing fee is set by the payment processor and depends on the card you use, so
          the figures above are an estimate. Your receipt carries the exact amounts.
        </p>
      ) : null}
    </section>
  )
}
