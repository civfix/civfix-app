"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"

import { Wordmark } from "@/components/brand"
import { hasPersistedCache } from "@/lib/query-persist"
import { useAuthResolved } from "@/hooks/use-auth"

/**
 * Cold-boot splash. On the FIRST-EVER load (no persisted query cache) the app has nothing to paint but
 * skeletons, so we show a full-screen branded splash until the session resolves - turning a flash of
 * empty chrome into a deliberate boot moment. A warm load (cache present) restores synchronously and
 * paints instantly, so the splash never lingers.
 *
 * SSR hydration safety: the cold-vs-warm decision reads `hasPersistedCache()` (localStorage), which is
 * client-only - the static-export prerendered HTML cannot know it. To keep the server render and the
 * first client paint byte-identical (no hydration mismatch), the cold decision is deferred to a
 * post-mount effect: the FIRST render is always the splash (`mounted === false`), which matches the
 * prerender. Immediately after mount the effect captures `hasPersistedCache()` once - a warm load flips
 * to children on the same commit (no flash, the synchronous restore already repainted from cache), and
 * a cold load keeps the splash until auth resolves OR a safety timeout fires, whichever comes first, so
 * a slow/offline network can never trap the user behind the splash.
 */

/** Max time the splash is held before it reveals the app regardless of auth state. */
const SAFETY_TIMEOUT_MS = 1500

export function BootSplash({ children }: { children: React.ReactNode }) {
  // First render (server prerender + first client paint) is identical: not yet mounted, so show the
  // splash. After mount the client decides cold-vs-warm from localStorage; until then `isCold` is unset.
  const [isCold, setIsCold] = React.useState<boolean | null>(null)
  const authResolved = useAuthResolved()
  const [timedOut, setTimedOut] = React.useState(false)

  // Layout effect (not a plain effect): it runs synchronously after commit but BEFORE the browser
  // paints, so a warm load dismisses the splash on the same frame the cache restore repaints content -
  // no one-frame splash flash. Layout effects do not run during the static prerender, so the first
  // server/client render (the splash) still matches; the cold-vs-warm decision is purely client-side.
  React.useLayoutEffect(() => {
    const cold = !hasPersistedCache()
    setIsCold(cold)
    if (!cold) return
    const timer = setTimeout(() => setTimedOut(true), SAFETY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [])

  // Before the effect runs (the SSR-consistent first paint) `isCold` is null, so render the splash so the
  // server and first client render agree. A warm load then hides it on mount; a cold load holds it until
  // auth resolves or the timeout fires.
  const showSplash = isCold === null || (isCold && !authResolved && !timedOut)

  return (
    <>
      {showSplash ? <Splash /> : null}
      {children}
    </>
  )
}

/** The full-screen branded splash. Accessible: a polite status region marked busy while it is shown. */
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
        zIndex: 300,
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
