/**
 * Shared props for the portrait shell's OVERLAY (full-page) host.
 *
 * ONE CHOKE POINT, TWO PRESENTATIONS. Every shell-owned page on native - all ~24 converted details plus
 * the four bodies that draw their own header - is mounted by this host and by nothing else, which is why
 * swipe-back and push/pop animation land here once instead of per body. The two seams are genuinely
 * different components, not one component with a flag:
 *
 *   PageStack.web    ONE body, no gesture, no layering: the exact markup PortraitShell.shared carried
 *                    before the seam existed (KeyboardAvoidingView -> shell DetailHeader -> ScrollHost ->
 *                    BodyTransition), consuming `entry`/`transitionKey`/`direction`. Web presents details
 *                    as a pull-up sheet and reaches this layer only for the handful of table-"full" kinds,
 *                    so there is no page stack to animate and nothing to change.
 *   PageStack.native N retained, keyed layers from `entries`/`layerKeys`, an interactive left-edge back
 *                    swipe, and full-width push/pop slides.
 *
 * BOTH SHAPES ARE CARRIED because both are correct for their seam - `entry` is not a derived convenience
 * that native could recompute, it is what `portraitFramePlan` already published and what web still needs
 * unchanged. `entry === entries[entries.length - 1]` by construction (`portraitFramePlan` derives both
 * from one `fullEntryStack` scan).
 */
import type { DetailEntry, View as NavView } from "../nav"
import type { BodyTransitionDirection } from "./BodyTransition.types"
import type { ScrollHostValue } from "./ScrollHost"

/** The shell's body factory (AppShell's `renderBody`), narrowed to what this host calls it with. */
export type PageStackRenderBody = (entry: DetailEntry | null, view: NavView) => React.ReactNode

export interface PageStackProps {
  /** WEB: the single overlay body (`frame.overlay.entry`). Null when no page is up. */
  entry: DetailEntry | null
  /** WEB: `frame.overlay.transitionKey` - the BodyTransition identity. */
  transitionKey: string
  /** WEB: the BodyTransition direction (`useStackDirection(stack.length)`). */
  direction: BodyTransitionDirection
  /** NATIVE: the whole page stack, BOTTOM first (`frame.overlay.entries`). */
  entries: readonly DetailEntry[]
  /** NATIVE: `frame.overlay.layerKeys` - the stable React key of each layer, parallel to `entries`. */
  layerKeys: readonly string[]
  /** `frame.overlay.bodyMounted` - is there a page at all? */
  bodyMounted: boolean
  /** `frame.overlay.interactive` - false while a sheet rides above a still-mounted page. */
  interactive: boolean
  /** `frame.overlay.keyboardAvoidance` - the composer's shell-level keyboard inset. */
  keyboardAvoidance: boolean
  /** WEB only: the measured soft-keyboard reserve, or null. Native gets it from KeyboardAvoidingView. */
  webKeyboardInset: { paddingBottom: number } | null
  /**
   * The safe-area padding a page wears. Applied INSIDE this host (per layer on native, on the host's own
   * box on web) rather than on the shell's overlay wrapper: a native layer must cover the full screen -
   * background and all - while it slides, and an absolutely-positioned child of a PADDED box is laid out
   * against the padding edge, which would leave the status-bar strip showing whatever is behind.
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
