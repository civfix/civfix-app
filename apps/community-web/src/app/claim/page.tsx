import { Suspense } from "react"

import { ClaimView } from "@/features/claim/claim-view"

/**
 * /claim - link an anonymously-submitted report into a signed-in account.
 *
 * ClaimView reads the claim code from the `code` search param, so it must sit under a Suspense
 * boundary (Next 15 requires useSearchParams consumers to be wrapped for the static export). The
 * fallback is intentionally minimal; the real value prop / linked-report UI renders client-side.
 */
export default function ClaimPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-paper" aria-hidden="true" />}>
      <ClaimView />
    </Suspense>
  )
}
