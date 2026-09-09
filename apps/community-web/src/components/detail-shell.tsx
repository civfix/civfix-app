"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useT } from "@civfix/ui/i18n"

import { Wordmark } from "@/components/brand"

/**
 * Shared chrome for the standalone (non-shell) views - today only /claim.
 *
 * A warm paper page with a slim top bar (Back + civfix wordmark) and a centered column. Every other
 * surface now renders inside the shared @civfix/ui AppShell, which supplies its own panel chrome.
 */
export function DetailShell({
  children,
  backLabel,
  onBack,
  maxWidth = "max-w-xl",
}: {
  children: React.ReactNode
  /** Override the default localized "Back" label. */
  backLabel?: string
  /** Override the default behavior (router.back with a home fallback). */
  onBack?: () => void
  /** Tailwind max-width class for the content column. */
  maxWidth?: string
}) {
  const router = useRouter()
  const { t } = useT("web-common")

  const handleBack = React.useCallback(() => {
    if (onBack) return onBack()
    // Prefer going back; fall back to the home map if there is no history (deep link / fresh tab).
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push("/")
    }
  }, [onBack, router])

  return (
    <div className="min-h-[100dvh] bg-paper">
      <header className="sticky top-0 z-20 border-b border-ink-5 bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-token-14 font-semibold text-ink-2 transition-colors hover:bg-paper2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel ?? t("detail.back")}
          </button>
          <Wordmark className="ml-auto select-none text-token-18" />
        </div>
      </header>
      <main className={`mx-auto w-full ${maxWidth} px-4 py-6 sm:py-8`}>{children}</main>
    </div>
  )
}
