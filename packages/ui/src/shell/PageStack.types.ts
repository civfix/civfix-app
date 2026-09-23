/**
 * Shared props for the portrait shell's OVERLAY (full-page) host.
 *
 * ONE CHOKE POINT, TWO PRESENTATIONS. Every shell-owned page - all ~24 converted details plus the four
 * bodies that draw their own header - is mounted by this host and by nothing else, which is why push/pop
 * animation lands here once instead of per body. Both seams keep N retained, keyed layers from
 * `entries`/`layerKeys` and slide whole pages on push/pop; they differ in the driver:
 *
 *   PageStack.web    CSS transitions on transform/opacity, direction from `useStackDirection`, no
 *                    gesture (the browser owns back-swipe), instant on a history restore.
 *   PageStack.native reanimated shared values plus an interactive left-edge back swipe.
 */
import type { DetailEntry, View as NavView } from "../nav"
import type { BodyTransitionDirection } from "./BodyTransition.types"
import type { ScrollHostValue } from "./ScrollHost"

/** The shell's body factory (AppShell's `renderBody`), narrowed to what this host calls it with. */
export type PageStackRenderBody = (entry: DetailEntry | null, view: NavView) => React.ReactNode

export interface PageStackProps {
  /** WEB: the push/pop/replace direction of the latest change (`useStackDirection(stack.length)`). */
  direction: BodyTransitionDirection
  /** The whole page stack, BOTTOM first (`frame.overlay.entries`). */
  entries: readonly DetailEntry[]
  /** `frame.overlay.layerKeys` - the stable React key of each layer, parallel to `entries`. */
  layerKeys: readonly string[]
  /** `frame.overlay.interactive` - false while a sheet rides above a still-mounted page. */
  interactive: boolean
  /** `frame.overlay.keyboardAvoidance` - the composer's shell-level keyboard inset. */
  keyboardAvoidance: boolean
  /** WEB only: the measured soft-keyboard reserve, or null. Native gets it from KeyboardAvoidingView. */
  webKeyboardInset: { paddingBottom: number } | null
  /**
   * The safe-area padding a page wears. Applied INSIDE this host, per layer, rather than on the shell's
   * overlay wrapper: a layer must cover the full screen -
   * background and all - while it slides, and an absolutely-positioned child of a PADDED box is laid out
   * against the padding edge, which would leave the status-bar strip showing whatever is behind. The
   * BOTTOM half is routed per page (`pageBottomReserve`): a page whose body owns its scroll
   * wears it as scroll-CONTENT padding, so its list runs under the home indicator instead of being cut
   * off above a strip of layer background; only a footer-pinning page keeps it on the box.
   */
  insets: { paddingTop: number; paddingBottom: number }
  /** The scroll host every page body consumes (`PLAIN_SCROLL_HOST` or the keyboard-aware one). */
  scrollHost: ScrollHostValue
  /** The live nav stack - the back-affordance gate's authority, and the swipe's arming input. */
  stack: readonly DetailEntry[]
  /** The live nav view (what `renderBody` is called with). */
  view: NavView
  /** Builds a body element for an entry. Referentially stable in the default AppShell wiring. */
  renderBody: PageStackRenderBody
}
