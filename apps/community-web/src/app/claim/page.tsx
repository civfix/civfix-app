import { Suspense } from "react"

import { ClaimView } from "@/features/claim/claim-view"

/**
 * ClaimView reads the claim code with useSearchParams, which Next 15 only allows under a Suspense
 * boundary in a static export.
 */
export default function ClaimPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-paper" aria-hidden="true" />}>
      <ClaimView />
    </Suspense>
  )
}
