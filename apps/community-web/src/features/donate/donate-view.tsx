"use client"

import * as React from "react"
import type { Stripe } from "@stripe/stripe-js"
import {
  ErrorCode,
  currentVersion,
  previewDonationFees,
  type CreateDonationCheckoutResponse,
  type FeeBreakdownDTO,
  type GetPublicOrgDonationPageResponse,
} from "@civfix/shared"

import { api, toAppError } from "@/lib/api"
import { STRIPE_PUBLISHABLE_KEY, loadStripeForAccount } from "@/lib/stripe-js"
import { TURNSTILE_ACTION_DONATE, TURNSTILE_SITEKEY, runTurnstile } from "@/lib/turnstile"
import { useAuthStore } from "@/store/auth-store"
import { AmountField } from "./amount-field"
import { CompleteView, rememberStatusToken } from "./complete-view"
import { ShareIdentityCheckbox, TermsCheckbox } from "./consent-block"
import { amountInputValue, amountVerdict, formatMinor, parseAmountToMinor } from "./donate-amount"
import { DisclosuresBlock } from "./disclosures-block"
import { DonateShell, DonateUnavailable } from "./states"
import { DonorFields } from "./donor-fields"
import { FeeBreakdown } from "./fee-breakdown"
import { OrgHeader } from "./org-header"
import { PaymentPanel } from "./payment-panel"
import { donateCompletePath, parseDonateRoute, parseEventParam } from "./donate-route"
import { intentKey, newAttemptNonce } from "./donate-intent"

export const DONATE_UI_TEMPLATE_VERSION = "donate-web-1"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type PageState =
  | { readonly kind: "loading" }
  | { readonly kind: "not_found" }
  | { readonly kind: "offline" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "ready"; readonly page: GetPublicOrgDonationPageResponse }

export function DonateView() {
  const [route, setRoute] = React.useState<ReturnType<typeof parseDonateRoute> | null>(null)

  React.useEffect(() => {
    setRoute(parseDonateRoute(window.location.pathname))
  }, [])

  if (route === null) return <DonateShell busy>Loading…</DonateShell>
  if (route.kind === "complete") return <CompleteView />
  if (route.kind === "missing" || route.kind === "invalid") {
    return (
      <DonateUnavailable title="We couldn't find that organization">
        This donation link is not valid. Check the link you followed, or find the organization on{" "}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">civfix</a>.
      </DonateUnavailable>
    )
  }
  return <DonateForm slug={route.slug} />
}

function DonateForm({ slug }: { slug: string }) {
  const [state, setState] = React.useState<PageState>({ kind: "loading" })
  const viewerEmail = useAuthStore((store) => store.user?.email ?? null)
  const isAuthenticated = useAuthStore((store) => store.status === "authenticated")
  const eventId = React.useMemo(
    () => (typeof window === "undefined" ? null : parseEventParam(window.location.search)),
    [],
  )

  React.useEffect(() => {
    let cancelled = false
    api
      .getPublicOrgDonationPage({ slug })
      .then((page) => {
        if (cancelled) return
        setState(
          page.donateState === "READY" || page.donateState === "AT_RISK"
            ? { kind: "ready", page }
            : { kind: "unavailable" },
        )
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const code = toAppError(error).code
        if (code === ErrorCode.NOT_FOUND) setState({ kind: "not_found" })
        else if (code === ErrorCode.PAYMENT_UNAVAILABLE) setState({ kind: "unavailable" })
        else setState({ kind: "offline" })
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (state.kind === "loading") return <DonateShell busy>Loading the donation page…</DonateShell>

  if (state.kind === "not_found") {
    return (
      <DonateUnavailable title="We couldn't find that organization">
        This organization is not accepting donations through civfix. Find it on{" "}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">civfix</a> for other ways to help.
      </DonateUnavailable>
    )
  }

  if (state.kind === "unavailable") {
    return (
      <DonateUnavailable title="Donations are temporarily unavailable">
        Donations to this organization are paused right now. Nothing was charged. Please try again
        later.
      </DonateUnavailable>
    )
  }

  if (state.kind === "offline") {
    return (
      <DonateUnavailable title="We couldn't reach civfix">
        The donation page could not be loaded, so nothing has been charged. Check your connection and
        reload.
      </DonateUnavailable>
    )
  }

  if (!STRIPE_PUBLISHABLE_KEY || state.page.stripeAccount === null) {
    return (
      <DonateUnavailable title="Donations are temporarily unavailable">
        The payment form is not configured on this build, so nothing can be charged here. Please try
        again later.
      </DonateUnavailable>
    )
  }

  return (
    <DonateDocument
      page={state.page}
      slug={slug}
      eventId={eventId}
      isAuthenticated={isAuthenticated}
      viewerEmail={viewerEmail}
    />
  )
}

interface DonateDocumentProps {
  page: GetPublicOrgDonationPageResponse
  slug: string
  eventId: string | null
  isAuthenticated: boolean
  viewerEmail: string | null
}

type CommitState =
  | { readonly kind: "editing" }
  | { readonly kind: "committing" }
  | { readonly kind: "committed"; readonly checkout: CreateDonationCheckoutResponse }
  | { readonly kind: "succeeded" }

function DonateDocument({
  page,
  slug,
  eventId,
  isAuthenticated,
  viewerEmail,
}: DonateDocumentProps) {
  const [amountText, setAmountText] = React.useState(() => {
    const seed = page.suggestedAmountsMinor[1] ?? page.suggestedAmountsMinor[0]
    return seed === undefined ? "" : amountInputValue(seed)
  })
  const [email, setEmail] = React.useState(viewerEmail ?? "")
  const [name, setName] = React.useState("")
  const [shareIdentity, setShareIdentity] = React.useState(false)
  const [termsAccepted, setTermsAccepted] = React.useState(false)
  const [showErrors, setShowErrors] = React.useState(false)
  const [commit, setCommit] = React.useState<CommitState>({ kind: "editing" })
  const [commitError, setCommitError] = React.useState<string | null>(null)
  const commitInFlight = React.useRef(false)
  const attemptNonce = React.useRef<string>(newAttemptNonce())

  const parsedAmount = parseAmountToMinor(amountText)
  const amountState = amountVerdict(amountText, page.minAmountMinor, page.maxAmountMinor)
  const emailValid = EMAIL_PATTERN.test(email.trim())
  const locked = commit.kind !== "editing"

  const previewBreakdown = React.useMemo<FeeBreakdownDTO | null>(() => {
    if (!parsedAmount.ok || parsedAmount.amountMinor <= 0) return null
    const preview = previewDonationFees({
      amountMinor: parsedAmount.amountMinor,
      platformFeeBps: page.platformFeeBps,
      processingFeeBps: page.processingFeeBps,
      processingFeeFixedMinor: page.processingFeeFixedMinor,
    })
    return {
      grossMinor: preview.grossMinor,
      platformFeeMinor: preview.platformFeeMinor,
      processorFeeMinor: preview.estimatedProcessingFeeMinor,
      processorFeeIsEstimate: true,
      netMinor: preview.estimatedNetMinor,
      platformFeeBps: preview.platformFeeBps,
      currency: "USD",
    }
  }, [parsedAmount, page.platformFeeBps, page.processingFeeBps, page.processingFeeFixedMinor])

  const stripePromise = React.useMemo<Promise<Stripe | null> | null>(
    () =>
      commit.kind === "committed" ? loadStripeForAccount(commit.checkout.stripeAccount) : null,
    [commit],
  )

  const canContinue = amountState === "ok" && emailValid && termsAccepted

  const donorEmail = email.trim().toLowerCase()
  const donorName = name.trim()

  const idempotencyKey = intentKey(attemptNonce.current, {
    slug,
    amountMinor: parsedAmount.ok ? parsedAmount.amountMinor : 0,
    email: donorEmail,
    name: donorName,
    eventId,
    shareIdentity,
  })

  const onContinue = React.useCallback(async () => {
    setShowErrors(true)
    if (!canContinue || commit.kind !== "editing" || !parsedAmount.ok) return
    if (commitInFlight.current) return
    commitInFlight.current = true
    setCommit({ kind: "committing" })
    setCommitError(null)
    try {
      const turnstileToken =
        !isAuthenticated && page.requiresTurnstile && TURNSTILE_SITEKEY
          ? await runTurnstile(TURNSTILE_ACTION_DONATE)
          : ""
      const checkout = await api.createDonationCheckout({
        orgSlug: slug,
        amountMinor: parsedAmount.amountMinor,
        currency: "USD",
        email: donorEmail,
        ...(donorName.length > 0 ? { name: donorName } : {}),
        ...(eventId ? { eventId } : {}),
        shareIdentity,
        consent: {
          termsVersion: currentVersion("terms"),
          privacyVersion: currentVersion("privacy"),
          donationTermsVersion: currentVersion("donations"),
          disclosureVersion: page.disclosureVersion,
          surface: "web_donate",
          screenRoute: `/donate/${slug}`,
          uiTemplateVersion: DONATE_UI_TEMPLATE_VERSION,
        },
        idempotencyKey,
        ...(turnstileToken.length > 0 ? { turnstileToken } : {}),
      })
      rememberStatusToken(checkout.donationId, checkout.statusToken)
      setCommit({ kind: "committed", checkout })
    } catch (error) {
      const appError = toAppError(error)
      setCommit({ kind: "editing" })
      setCommitError(commitErrorMessage(appError.code, appError.fields))
      if (refusedBeforeAnyWrite(appError.code)) attemptNonce.current = newAttemptNonce()
    } finally {
      commitInFlight.current = false
    }
  }, [
    canContinue,
    commit.kind,
    donorEmail,
    donorName,
    eventId,
    idempotencyKey,
    isAuthenticated,
    page.disclosureVersion,
    page.requiresTurnstile,
    parsedAmount,
    shareIdentity,
    slug,
  ])

  const onSucceededInPlace = React.useCallback(() => {
    if (commit.kind !== "committed") return
    const donationId = commit.checkout.donationId
    window.history.replaceState(
      null,
      "",
      `${donateCompletePath(slug)}?donation=${encodeURIComponent(donationId)}`,
    )
    setCommit({ kind: "succeeded" })
  }, [commit, slug])

  if (commit.kind === "succeeded") return <CompleteView />

  const authoritativeBreakdown =
    commit.kind === "committed" ? commit.checkout.feeBreakdown : previewBreakdown

  return (
    <main className="donate-page">
      <div className="donate-shell">
        <OrgHeader org={page.org} event={page.event ?? null} />

        {page.donateState === "AT_RISK" ? (
          <p className="donate-banner" role="status">
            This organization is completing a verification step with our payment processor. Donations
            still go through, and we will email you if anything changes.
          </p>
        ) : null}

        <AmountField
          suggestedAmountsMinor={page.suggestedAmountsMinor}
          minAmountMinor={page.minAmountMinor}
          maxAmountMinor={page.maxAmountMinor}
          value={amountText}
          onChange={setAmountText}
          disabled={locked}
          errorId="donate-amount-error"
          error={showErrors ? amountErrorMessage(amountState, page) : null}
        />

        <DonorFields
          email={email}
          name={name}
          onEmailChange={setEmail}
          onNameChange={setName}
          disabled={locked}
          emailError={showErrors && !emailValid ? "Enter an email address for your receipt." : null}
        />

        <FeeBreakdown
          breakdown={authoritativeBreakdown}
          recipientLegalName={page.org.legalName}
          authoritative={commit.kind === "committed"}
        />

        <DisclosuresBlock
          disclosures={page.disclosures}
          taxDeductibility={page.taxDeductibility}
          disclosureVersion={page.disclosureVersion}
        />

        <ShareIdentityCheckbox
          policy={page.donorSharing}
          checked={shareIdentity}
          onChange={setShareIdentity}
          disabled={locked}
        />

        <TermsCheckbox
          recipientLegalName={page.org.legalName}
          checked={termsAccepted}
          onChange={setTermsAccepted}
          disabled={locked}
          error={showErrors && !termsAccepted ? "Please confirm before continuing." : null}
        />

        {commitError ? (
          <p className="donate-field-error" role="alert">
            {commitError}
          </p>
        ) : null}

        {commit.kind === "committed" && stripePromise !== null ? null : (
          <button
            type="button"
            className="donate-continue"
            data-testid="donate-continue"
            disabled={!canContinue || commit.kind === "committing"}
            onClick={() => {
              void onContinue()
            }}
          >
            {commit.kind === "committing" ? "Preparing…" : "Continue to payment"}
          </button>
        )}

        {commit.kind === "committed" && stripePromise !== null ? (
          <PaymentPanel
            stripe={stripePromise}
            clientSecret={commit.checkout.clientSecret}
            email={email.trim()}
            amountMinor={commit.checkout.feeBreakdown.grossMinor}
            feeBreakdown={commit.checkout.feeBreakdown}
            recipientLegalName={page.org.legalName}
            returnUrl={commit.checkout.returnUrl}
            onSucceededInPlace={onSucceededInPlace}
          />
        ) : null}

        <footer className="donate-foot">
          <a href="/legal/donations">How donations through civfix work</a> ·{" "}
          <a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a>
        </footer>
      </div>
    </main>
  )
}

function refusedBeforeAnyWrite(code: ErrorCode): boolean {
  return (
    code === ErrorCode.VALIDATION ||
    code === ErrorCode.CONFLICT ||
    code === ErrorCode.TURNSTILE_FAILED ||
    code === ErrorCode.NOT_FOUND
  )
}

function amountErrorMessage(
  verdict: ReturnType<typeof amountVerdict>,
  page: GetPublicOrgDonationPageResponse,
): string | null {
  switch (verdict) {
    case "ok":
      return null
    case "empty":
      return "Enter an amount."
    case "invalid":
      return "Enter an amount in dollars and cents, for example 25 or 25.50."
    case "below_min":
      return `The smallest donation is ${formatMinor(page.minAmountMinor)}.`
    case "above_max":
      return `The largest donation through civfix is ${formatMinor(page.maxAmountMinor)}.`
  }
}

function commitErrorMessage(
  code: ErrorCode,
  fields: Readonly<Record<string, string>> | undefined,
): string {
  switch (code) {
    case ErrorCode.PAYMENT_UNAVAILABLE:
      return "Donations to this organization are unavailable right now. Nothing was charged."
    case ErrorCode.VALIDATION:
      return fields?.amountMinor ?? fields?.email ?? "Please check the details above and try again."
    case ErrorCode.CONFLICT:
      return "Our terms were updated while you were on this page. Reload to see the current version."
    case ErrorCode.RATE_LIMITED:
      return "Too many attempts. Wait a minute and try again. Nothing was charged."
    case ErrorCode.TURNSTILE_FAILED:
      return "We could not confirm you are not a bot. Reload the page and try again."
    default:
      return "We could not start the payment. Nothing was charged. Please try again."
  }
}
