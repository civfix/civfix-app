"use client"

import * as React from "react"

interface DonorFieldsProps {
  email: string
  name: string
  onEmailChange: (next: string) => void
  onNameChange: (next: string) => void
  disabled: boolean
  emailError?: string | null
}

export function DonorFields({
  email,
  name,
  onEmailChange,
  onNameChange,
  disabled,
  emailError,
}: DonorFieldsProps) {
  return (
    <section className="donate-donor" aria-labelledby="donate-donor-heading">
      <h2 id="donate-donor-heading">Your details</h2>

      <div className="donate-field">
        <label htmlFor="donate-email">Email address</label>
        <input
          id="donate-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          disabled={disabled}
          aria-describedby={emailError ? "donate-email-error" : "donate-notice-at-collection"}
          aria-invalid={emailError ? true : undefined}
          onChange={(cause) => onEmailChange(cause.target.value)}
        />
        {emailError ? (
          <p className="donate-field-error" id="donate-email-error" role="alert">
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="donate-field">
        <label htmlFor="donate-name">Name (optional)</label>
        <input
          id="donate-name"
          type="text"
          autoComplete="name"
          value={name}
          disabled={disabled}
          onChange={(cause) => onNameChange(cause.target.value)}
        />
      </div>

      <p className="donate-field-hint" id="donate-notice-at-collection">
        civfix collects your email address to send your receipt, plus the amount, date and the last four
        digits of your card as the record of your donation. Your card details go directly to our payment
        processor and never reach civfix. We keep the donation record for seven years and never sell or
        share it. See the <a href="/legal/privacy">Privacy Policy</a>.
      </p>
    </section>
  )
}
