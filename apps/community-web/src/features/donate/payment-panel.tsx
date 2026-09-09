"use client"

import * as React from "react"
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout"
import type { Stripe } from "@stripe/stripe-js"
import type { FeeBreakdownDTO } from "@civfix/shared"

import { useColorScheme } from "@/lib/color-scheme"
import { stripeAppearance } from "@/lib/stripe-appearance"
import { formatMinor } from "./donate-amount"
import { FeeBreakdown } from "./fee-breakdown"

interface PaymentPanelProps {
  stripe: Promise<Stripe | null>
  clientSecret: string
  email: string
  amountMinor: number
  feeBreakdown: FeeBreakdownDTO
  recipientLegalName: string
  returnUrl: string
  onSucceededInPlace: () => void
}

export function PaymentPanel({
  stripe,
  clientSecret,
  email,
  amountMinor,
  feeBreakdown,
  recipientLegalName,
  returnUrl,
  onSucceededInPlace,
}: PaymentPanelProps) {
  const scheme = useColorScheme()
  const options = React.useMemo(
    () => ({
      clientSecret,
      elementsOptions: { appearance: stripeAppearance(scheme) },
      defaultValues: { email },
    }),
    [clientSecret, scheme, email],
  )

  return (
    <CheckoutElementsProvider stripe={stripe} options={options}>
      <PaymentForm
        amountMinor={amountMinor}
        feeBreakdown={feeBreakdown}
        recipientLegalName={recipientLegalName}
        returnUrl={returnUrl}
        onSucceededInPlace={onSucceededInPlace}
      />
    </CheckoutElementsProvider>
  )
}

interface PaymentFormProps {
  amountMinor: number
  feeBreakdown: FeeBreakdownDTO
  recipientLegalName: string
  returnUrl: string
  onSucceededInPlace: () => void
}

function PaymentForm({
  amountMinor,
  feeBreakdown,
  recipientLegalName,
  returnUrl,
  onSucceededInPlace,
}: PaymentFormProps) {
  const result = useCheckoutElements()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inFlight = React.useRef(false)

  const checkout = result.type === "success" ? result.checkout : null

  const pay = React.useCallback(async () => {
    if (checkout === null || inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setError(null)
    try {
      const confirmed = await checkout.confirm({ returnUrl, redirect: "if_required" })
      if (confirmed.type === "error") {
        setError(confirmed.error.message)
        return
      }
      onSucceededInPlace()
    } catch {
      setError("We could not reach the payment processor. Your card has not been charged.")
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }, [checkout, returnUrl, onSucceededInPlace])

  if (result.type === "loading") {
    return (
      <section className="donate-payment" aria-labelledby="donate-payment-heading" aria-busy="true">
        <h2 id="donate-payment-heading">Payment</h2>
        <p className="donate-field-hint">Loading the secure payment form…</p>
      </section>
    )
  }

  if (result.type === "error") {
    return (
      <section className="donate-payment" aria-labelledby="donate-payment-heading">
        <h2 id="donate-payment-heading">Payment</h2>
        <p className="donate-field-error" role="alert">
          The payment form could not be loaded, so your card has not been charged. Reload the page to
          try again.
        </p>
      </section>
    )
  }

  return (
    <section className="donate-payment" aria-labelledby="donate-payment-heading">
      <h2 id="donate-payment-heading">Payment</h2>
      <PaymentElement options={{ layout: "accordion" }} />

      <FeeBreakdown
        breakdown={feeBreakdown}
        recipientLegalName={recipientLegalName}
        authoritative={true}
        idPrefix="donate-pay-fees"
      />

      {error ? (
        <p className="donate-field-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="donate-pay"
        data-testid="donate-pay"
        disabled={submitting}
        onClick={() => {
          void pay()
        }}
      >
        {submitting
          ? "Processing…"
          : `Donate ${formatMinor(amountMinor)} to ${recipientLegalName}`}
      </button>
    </section>
  )
}
