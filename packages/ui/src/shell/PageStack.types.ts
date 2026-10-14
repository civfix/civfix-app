/**
 * Props for the portrait shell's overlay (full-page) host. Every shell-owned page is mounted by this host
 * and nothing else, so push/pop animation lands here once instead of per body. Both seams keep retained,
 * keyed layers and slide whole pages: web with CSS transitions and no gesture (the browser owns
 * back-swipe), native with reanimated and an interactive left-edge back swipe.
 */
import type { DetailEntry, View as NavView } from "../nav"
import type { BodyTransitionDirection } from "./BodyTransition.types"
import type { ScrollHostValue } from "./ScrollHost"

export type PageStackRenderBody = (entry: DetailEntry | null, view: NavView) => React.ReactNode

export interface PageStackProps {
  /** Web only. */
  direction: BodyTransitionDirection
  /** Bottom first. */
  entries: readonly DetailEntry[]
  /** Parallel to `entries`. */
  layerKeys: readonly string[]
  /** False while a sheet rides above a still-mounted page. */
  interactive: boolean
  keyboardAvoidance: boolean
  /** Web only; native gets it from KeyboardAvoidingView. */
  webKeyboardInset: { paddingBottom: number } | null
  /**
   * Applied per layer inside this host, not on the overlay wrapper: a layer must cover the full screen
   * while it slides, and an absolutely-positioned child of a padded box is laid out against the padding
   * edge, which would expose the status-bar strip. The bottom half is routed per page
   * (`pageBottomReserve`): a scroll-owning page wears it as content padding so its list runs under the
   * home indicator; only a footer-pinning page keeps it on the box.
   */
  insets: { paddingTop: number; paddingBottom: number }
  scrollHost: ScrollHostValue
  stack: readonly DetailEntry[]
  view: NavView
  /** Referentially stable in the default AppShell wiring. */
  renderBody: PageStackRenderBody
}
