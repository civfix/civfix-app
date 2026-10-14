"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"

import { Wordmark } from "@/components/brand"
import { hasPersistedCache } from "@/lib/query-persist"
import { useAuthResolved } from "@/hooks/use-auth"
import { Z_BOOT_SPLASH } from "@/styles/z-layers"

/**
 * On a first-ever load (no persisted query cache) the app has nothing to paint but skeletons, so a
 * branded splash holds until the session resolves or a safety timeout fires, whichever comes first, so a
 * slow or offline network never traps the user. A warm load restores from cache and paints at once.
 *
 * The cold-vs-warm check reads localStorage, which the prerendered HTML cannot know, so the first render
 * is always the splash (matching the prerender) and the decision is deferred to after mount.
 */

/** Max time the splash is held before it reveals the app regardless of auth state. */
const SAFETY_TIMEOUT_MS = 1500

export function BootSplash({ children }: { children: React.ReactNode }) {
  const [isCold, setIsCold] = React.useState<boolean | null>(null)
  const authResolved = useAuthResolved()
  const [timedOut, setTimedOut] = React.useState(false)

  // A layout effect runs before the browser paints, so a warm load dismisses the splash on the same frame
  // the cache restore repaints content. It does not run during the static prerender.
  React.useLayoutEffect(() => {
    const cold = !hasPersistedCache()
    setIsCold(cold)
    if (!cold) return
    const timer = setTimeout(() => setTimedOut(true), SAFETY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [])

  const showSplash = isCold === null || (isCold && !authResolved && !timedOut)

  return (
    <>
      {showSplash ? <Splash /> : null}
      {children}
    </>
  )
}

function Splash() {
  const { t } = useT("web-common")
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t("boot.loading_label")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_BOOT_SPLASH,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
      }}
    >
      <Wordmark className="cf-splash-mark" />
    </div>
  )
}
