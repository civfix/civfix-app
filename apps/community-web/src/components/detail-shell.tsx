"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useT } from "@civfix/ui/i18n"

import { Wordmark } from "@/components/brand"

function cameFromThisSite(): boolean {
  if (!document.referrer) return false
  try {
    return new URL(document.referrer).origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * Chrome for the standalone pages that render outside the shared AppShell (claim, service record, guest
 * cancel), which supplies its own panel chrome everywhere else.
 */
export function DetailShell({
  children,
  backLabel,
  onBack,
  maxWidth = "max-w-xl",
}: {
  children: React.ReactNode
  backLabel?: string
  onBack?: () => void
  maxWidth?: string
}) {
  const router = useRouter()
  const { t } = useT("web-common")

  const handleBack = React.useCallback(() => {
    if (onBack) return onBack()
    // Go back only to a civfix page. history.length also counts the external page (an email, a search
    // result) the visitor came from, and Back must not send them off the site; those land on the map.
    if (typeof window !== "undefined" && window.history.length > 1 && cameFromThisSite()) {
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
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-token-14 font-semibold text-ink-2 transition-colors duration-d2 ease-out hover:bg-paper2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel ?? t("detail.back")}
          </button>
          <Wordmark className="ml-auto select-none text-token-18" />
        </div>
      </header>
      <main className={`mx-auto w-full ${maxWidth} px-4 py-6 sm:py-8`}>{children}</main>
    </div>
  )
}
