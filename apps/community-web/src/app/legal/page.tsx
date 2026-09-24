"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

/**
 * /legal redirects to the Terms of Service, the default legal document. The app is a static-exported
 * SPA (no server), so this is a client-side `router.replace` rather than a server redirect; a
 * <noscript> link covers the rare no-JS case. Lives under the legal route-group layout, so the paper
 * background renders during the brief redirect rather than a flash of empty chrome.
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
