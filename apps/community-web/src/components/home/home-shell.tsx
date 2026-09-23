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
 * The shared @civfix/ui Map (via the web data wrapper HomeMap). maplibre-gl touches `window` and pulls
 * in the maplibre-gl bundle + the react-native-web pin renderer, so it is loaded client-only (ssr:false).
 * During the static export only the shell HTML is emitted; the map mounts at runtime. A plain warm paper
 * backdrop stands in until the chunk hydrates.
 *
 * UI-unification Stage 4 slice 5A: this was the web-only `features/map/map-view` MapView (deleted); it
 * is now the shared <Map/> behind the cross-platform contract, fed the web map data by HomeMap.
 */
const MapView = dynamic(() => import("@/features/map/home-map").then((m) => m.HomeMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-paper" aria-hidden="true" />,
})

/**
 * The unified @civfix/ui AppShell, rendered via react-native-web. It is authored in RN primitives and
 * reads `useWindowDimensions`, so - like MapView - it mounts client-side only (ssr:false) and never runs
 * during the static export. AppShell owns when the injected map and floating-control slots mount: the
 * expanded sidebar-over-map layout keeps both persistent, while the portrait plan mounts them only for
 * the Map surface. The host supplies the lazy slots but does not duplicate that navigation policy.
 */
const AppShell = dynamic(() => import("@civfix/ui").then((m) => m.AppShell), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-paper" aria-hidden="true" />,
})

/**
 * The shared MapControls (via the web wrapper WebMapControls). AppShell mounts this lazy slot alongside
 * the map in expanded mode and only for the portrait Map surface, so compact feed, inbox, and search
 * screens receive neither map chrome nor map-related subscriptions. Replaces the deleted DOM TopBar
 * (UI-unification Stage 4 slice 5B-1).
 */
const WebMapControls = dynamic(
  () => import("@/components/home/web-map-controls").then((m) => m.WebMapControls),
  { ssr: false },
)

/**
 * The shared "About civfix" modal (the same <BrandAboutCard/> the mobile /about route renders), mounted in
 * AppShell's top overlay slot so it sits above the sheet. It renders RN primitives via react-native-web
 * and reads no window at module scope, but - like the other shared surfaces - is loaded client-only
 * (ssr:false): it shows nothing until the "civfix" logo pill opens it (via the brand-about store).
 */
const WebBrandAbout = dynamic(
  () => import("@/components/home/web-brand-about").then((m) => m.WebBrandAbout),
  { ssr: false },
)

/**
 * The portrait "download the app" banner. Client-only (ssr:false) like the other shared surfaces: it
 * decides what to show from the live user agent, which the static export cannot know at build time. It
 * renders OUTSIDE <AppShell/> as a fixed strip at z-index 100 (above the shell's z0-71 layers), and the
 * map controls clear it via the banner height it publishes into the shared promo store.
 */
const AppDownloadBanner = dynamic(
  () => import("@/components/promo/app-download-banner").then((m) => m.AppDownloadBanner),
  { ssr: false },
)

/**
 * The single-screen composition for the web community app (UI-unification, stage 3B-2).
 *
 * Previously HomeShell hand-wired the z-ordered DOM stack (map + top bar + PanelHost sidebar + auth
 * modal) and seeded the web-only panel-stack from the URL. It now mounts the shared <AppShell/>, which
 * owns the z-order + the responsive sidebar/sheet swap + the nav store, and injects the existing web
 * DOM components into its slots:
 *   - map         = the lazy shared MapLibre <Map/> (via HomeMap) in its .cf-map container. AppShell
 *     decides whether it mounts: always in expanded mode and only on the Map surface in portrait.
 *   - mapControls = the lazy shared MapControls (via WebMapControls), governed by that same AppShell plan.
 *   - authOverlay = the existing AuthModal (a portal to <body>; rendered in the shell's top overlay slot
 *     so the shell owns its place in the stack, though the portal escapes to body either way) PLUS the
 *     shared <WebBrandAbout/> "About civfix" modal (opened from the map's "civfix" logo pill), which sits
 *     in the same top overlay slot so it layers above the sheet.
 *
 * Deep-linkability is preserved: useWebNavAdapter() seeds the unified store from the live URL (handling
 * the SPA-fallback placeholder, e.g. "/pin/_"), syncs history.pushState on nav, and re-seeds on popstate
 * (Back/Forward). The catch-all detail routes (/pin/[...id] etc.) and the section routes all render this
 * same shell, so a cold deep link boots here and seeds the matching panel.
 *
 * Boot/first-run/auth: BootSplash + FirstRunGate are mounted in <Providers/> (root layout), not here;
 * HomeShell only owns the AuthModal mount (open state lives in the UI store). That wiring is preserved.
 */
export function HomeShell() {
  useTeamInviteAccept()

  // URL <-> store bridge (seed on mount, pushState on nav, re-seed on popstate). Owns window.history.
  useWebNavAdapter()

  return <AppShellFrame />
}

/** The tabbable set the skip link searches for the card's first control (`tabindex="-1"` is a
 * programmatic target, not a stop). */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Laid out, painted and not hidden — the shell keeps hidden surfaces mounted (e.g. the card on Map). */
function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return false
  const style = window.getComputedStyle(el)
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0"
}

/**
 * Where "Skip to content" actually lands.
 *
 * `#main` wraps the WHOLE shell and the shell paints the map first in DOM order, so a plain `href="#main"`
 * moved focus to the landmark and the very next Tab went to the map canvas - the stop the link exists to
 * skip past (it saved zero stops, and the landmark itself measures 0px tall because every shell layer is
 * absolutely positioned). The link therefore resolves its target at activation time: the card's own scroll
 * region - the landscape sidebar / portrait sheet - which is the one scrollable region inside the landmark
 * that is not part of the injected map. Focusing it (tabIndex -1) puts the reading position on the card and
 * the next Tab lands on the card's first control ("New post"), skipping the canvas, the maplibre attribution
 * + zoom buttons and the four map-chrome floats.
 *
 * Fallbacks, in order: on the Map surface the card is emptied (no scroll region, no focusable descendants),
 * so we take the first control outside the map layers instead - the rail; and if even that is missing, the
 * landmark, which is the pre-JS behaviour. The map layers are matched through the host's OWN wrappers (the
 * `.cf-map` container and the map-controls `<nav>` this file renders), never through shared-shell internals.
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

/**
 * Activating "Skip to content" moves focus to the resolved target rather than following the hash to the
 * landmark. Module-level (not a hook): it depends on nothing but the live DOM, so the frame keeps rendering
 * with no hooks of its own and the handler identity is stable across renders.
 */
function skipToContent(event: React.MouseEvent<HTMLAnchorElement>): void {
  const main = document.getElementById("main")
  // No landmark yet (pre-hydration): leave the browser to follow `href="#main"`.
  if (!main) return
  event.preventDefault()
  const target = resolveSkipTarget(main)
  if (!target.matches(FOCUSABLE_SELECTOR)) {
    // A container landing (the card region, or the landmark fallback): make it a programmatic focus
    // target - never a tab stop - and tag it so globals.css can answer the focus without the UA ring.
    // Both writes are idempotent, and neither runs when the fallback is a real control, which keeps its
    // own house ring.
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
 * The shell composition WITHOUT the URL adapter: the skip link + <main> landmark + the fixed promo banner
 * + <AppShell/> with the four web slots filled.
 *
 * Split out of HomeShell so the /landscape verification route (components/dev/landscape-preview.tsx) can
 * mount the REAL shell against fake data without duplicating this wiring - and, crucially, without the URL
 * bridge: that route seeds the nav store itself and must keep its own address (a pushState to "/" would
 * navigate the harness away from the fake providers on the first tap). Product routes render HomeShell,
 * which is this plus `useWebNavAdapter()`; nothing else about their behavior changes.
 */
export function AppShellFrame() {
  const { t } = useT("web-common")

  return (
    <ShellFrame>
      {/* The link moves focus to the card region instead of following the hash to the landmark (see
          skipToContent / resolveSkipTarget); `href="#main"` stays as the no-JS / pre-hydration fallback. */}
      <a href="#main" className="cf-skip-link" onClick={skipToContent}>
        {t("a11y.skip_to_content")}
      </a>
      <main id="main" tabIndex={-1}>
        {/* The fixed banner comes before the app shell in DOM order, while the skip link targets this
            stable main landmark in both map and non-map compact views. */}
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
