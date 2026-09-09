"use client"

import * as React from "react"
import type { DonorSharingPolicy } from "@civfix/shared"

interface ShareIdentityCheckboxProps {
  policy: DonorSharingPolicy
  checked: boolean
  onChange: (next: boolean) => void
  disabled: boolean
}

export function ShareIdentityCheckbox({
  policy,
  checked,
  onChange,
  disabled,
}: ShareIdentityCheckboxProps) {
  return (
    <div className="donate-check">
      <input
        id="donate-share-identity"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby="donate-share-identity-help"
        onChange={(cause) => onChange(cause.target.checked)}
      />
      <div>
        <label htmlFor="donate-share-identity">{policy.optInLabel}</label>
        <p className="donate-field-hint" id="donate-share-identity-help">
          {policy.whatIsShared}
        </p>
      </div>
    </div>
  )
}

interface TermsCheckboxProps {
  recipientLegalName: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled: boolean
  error?: string | null
}

export function TermsCheckbox({
  recipientLegalName,
  checked,
  onChange,
  disabled,
  error,
}: TermsCheckboxProps) {
  return (
    <div className="donate-check">
      <input
        id="donate-terms"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={error ? "donate-terms-error" : undefined}
        aria-invalid={error ? true : undefined}
        onChange={(cause) => onChange(cause.target.checked)}
      />
      <div>
        <label htmlFor="donate-terms">
          I have read the statements above. I understand that {recipientLegalName} receives this
          donation and is the merchant of record, that civfix charges a platform fee, and I agree to the{" "}
          <a href="/legal/terms" rel="noreferrer noopener" target="_blank">
            Terms of Service
          </a>
          , the{" "}
          <a href="/legal/donations" rel="noreferrer noopener" target="_blank">
            donation terms
          </a>{" "}
          and the{" "}
          <a href="/legal/privacy" rel="noreferrer noopener" target="_blank">
            Privacy Policy
          </a>
          .
        </label>
        {error ? (
          <p className="donate-field-error" id="donate-terms-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
