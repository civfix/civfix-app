"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context"
import { useLayoutMode } from "@civfix/ui/theme"
import { useT } from "@civfix/ui/i18n"

import { AuthModal } from "@/components/auth/auth-modal"
import { useWebNavAdapter } from "@/components/home/use-web-nav-adapter"
import { useTeamInviteAccept } from "@/components/home/use-team-invite-accept"

/**
 * maplibre-gl touches `window` and pulls in the maplibre-gl bundle and the react-native-web pin renderer,
 * so the map loads client-only; the static export emits only the shell, and a paper backdrop stands in
 * until the chunk hydrates.
 */
const MapView = dynamic(() => import("@/features/map/home-map").then((m) => m.HomeMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-paper" aria-hidden="true" />,
})

/**
 * AppShell reads `useWindowDimensions`, so it mounts client-only and never runs during the static export.
 * It decides when the injected map and control slots mount; the host supplies the slots but does not
 * duplicate that policy.
 */
const AppShell = dynamic(() => import("@civfix/ui").then((m) => m.AppShell), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-paper" aria-hidden="true" />,
})

/**
 * AppShell mounts this slot with the map in expanded mode and only on the portrait Map surface, so the
 * compact feed, inbox and search screens get neither map chrome nor map-related subscriptions.
 */
const WebMapControls = dynamic(
  () => import("@/components/home/web-map-controls").then((m) => m.WebMapControls),
  { ssr: false },
)

/**
 * Mounted in AppShell's top overlay slot so it sits above the sheet. Client-only like the other shared
 * surfaces; it renders nothing until the "civfix" logo pill opens it.
 */
const WebBrandAbout = dynamic(
  () => import("@/components/home/web-brand-about").then((m) => m.WebBrandAbout),
  { ssr: false },
)

/**
 * Client-only because it decides what to show from the live user agent, which the static export cannot
 * know at build time. It renders outside <AppShell/> as a fixed strip at z-index 100 (above the shell's
 * z0-71 layers); the map controls clear it via the height it publishes into the shared promo store.
 */
const AppDownloadBanner = dynamic(
  () => import("@/components/promo/app-download-banner").then((m) => m.AppDownloadBanner),
  { ssr: false },
)

/**
 * The catch-all detail routes and the section routes all render this same shell, so a cold deep link
 * boots here and useWebNavAdapter() seeds the matching panel from the live URL (including the
 * SPA-fallback placeholder such as "/pin/_"). BootSplash and FirstRunGate mount in <Providers/>, not here.
 */
export function HomeShell() {
  useTeamInviteAccept()

  useWebNavAdapter()

  return <AppShellFrame />
}

/** The tabbable set the skip link searches for the card's first control (`tabindex="-1"` is a
 * programmatic target, not a stop). */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Laid out, painted and not hidden: the shell keeps hidden surfaces mounted (e.g. the card on Map). */
function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return false
  const style = window.getComputedStyle(el)
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0"
}

/**
 * `#main` wraps the whole shell and the map comes first in DOM order, so following the hash would put the
 * next Tab on the map canvas, the very stop the link exists to skip. The target is resolved at activation
 * time instead: the card's own scroll region (landscape sidebar or portrait sheet), whose next Tab is the
 * card's first control.
 *
 * On the Map surface the card is empty, so the fallback is the first control outside the map layers (the
 * rail), then the landmark itself. The map layers are matched through this file's own wrappers (`.cf-map`
 * and the map-controls `<nav>`), never through shared-shell internals.
 */
function resolveSkipTarget(main: HTMLElement): HTMLElement {
  const cardRegion = Array.from(main.querySelectorAll<HTMLElement>("div")).find(
    (el) =>
      !el.closest(".cf-map") &&
      /auto|scroll/.test(window.getComputedStyle(el).overflowY) &&
      isVisible(el) &&
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).some(isVisible),
  )
  if (cardRegion) return cardRegion

  const firstPastTheMap = Array.from(main.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).find(
    (el) => !el.closest(".cf-map") && !el.closest("nav") && isVisible(el),
  )
  return firstPastTheMap ?? main
}

/** Module-level rather than a hook: it depends only on the live DOM, so the handler identity is stable. */
function skipToContent(event: React.MouseEvent<HTMLAnchorElement>): void {
  const main = document.getElementById("main")
  // No landmark yet (pre-hydration): leave the browser to follow `href="#main"`.
  if (!main) return
  event.preventDefault()
  const target = resolveSkipTarget(main)
  if (!target.matches(FOCUSABLE_SELECTOR)) {
    // A container landing becomes a programmatic focus target, never a tab stop, and is tagged so
    // globals.css can style the focus without the UA ring. A real control keeps its own ring.
    target.setAttribute("tabindex", "-1")
    target.setAttribute("data-cf-skip-target", "")
  }
  target.focus({ preventScroll: true })
}

const NO_SAFE_AREA: Metrics = {
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
}

const SHELL_FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const

function ShellFrame({ children }: { children: React.ReactNode }) {
  const shell = React.useRef<HTMLDivElement>(null)
  const layoutMode = useLayoutMode()

  // Written after mount, not rendered: the static prerender cannot know the viewport, so a rendered
  // value would mismatch hydration on every expanded screen.
  React.useEffect(() => {
    shell.current?.setAttribute("data-cf-layout", layoutMode)
  }, [layoutMode])

  return (
    <div ref={shell} className="cf-shell cf-design" data-cf-layout="compact">
      {children}
    </div>
  )
}

/**
 * The shell without the URL adapter, so the /landscape dev route can mount the real shell against fake
 * data. That route seeds the nav store itself and must keep its own address: a pushState to "/" would
 * navigate it away from the fake providers on the first tap.
 */
export function AppShellFrame() {
  const { t } = useT("web-common")

  return (
    <ShellFrame>
      {/* `href="#main"` stays as the no-JS and pre-hydration fallback. */}
      <a href="#main" className="cf-skip-link" onClick={skipToContent}>
        {t("a11y.skip_to_content")}
      </a>
      <main id="main" tabIndex={-1}>
        {/* The fixed banner comes before the app shell in DOM order, while the skip link targets this
            stable landmark in both map and non-map compact views. */}
        <AppDownloadBanner />
        <SafeAreaProvider initialMetrics={NO_SAFE_AREA} style={SHELL_FILL}>
          <AppShell
            map={
              <div className="cf-map">
                <MapView />
              </div>
            }
            mapControls={
              <nav aria-label={t("a11y.map_controls")}>
                <WebMapControls />
              </nav>
            }
            authOverlay={
              <>
                <AuthModal />
                <WebBrandAbout />
              </>
            }
          />
        </SafeAreaProvider>
      </main>
    </ShellFrame>
  )
}
