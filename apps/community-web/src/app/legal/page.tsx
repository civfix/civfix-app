"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

/**
 * The static export has no server, so the redirect to the Terms is a client-side `router.replace`;
 * the <noscript> link covers the no-JS case.
 */
export default function LegalIndexPage() {
  const router = useRouter()

  React.useEffect(() => {
    router.replace("/legal/terms")
  }, [router])

  return (
    <div className="legal-page">
      <noscript>
        <a href="/legal/terms/">Continue to the Terms of Service</a>
      </noscript>
    </div>
  )
}
