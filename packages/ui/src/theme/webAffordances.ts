/**
 * Web affordances for react-native-web (RNW). RNW gives Pressables keyboard activation and ARIA, but not a
 * pointer cursor, a keyboard focus ring, hover state or selectable text. Every export is gated on
 * `Platform.OS === "web"` and resolves to an empty object or a no-op on native, so native stays
 * pixel-identical.
 *
 * The focus ring targets CSS `:focus-visible` from one injected stylesheet rather than RNW's `focused`
 * flag, which is true for mouse focus too and would flash the ring on every click.
 */
import { Platform, type ViewStyle, type TextStyle, type PressableStateCallbackType } from "react-native"
import { tokens } from "@civfix/shared/tokens"
import { EASE_STANDARD_CSS } from "./motion"

const isWeb = Platform.OS === "web"

/** RNW adds a `hovered` flag to the Pressable state that RN's core types do not declare; the one cast lives here. */
export function webHover(state: PressableStateCallbackType): boolean {
  if (!isWeb) return false
  return (state as PressableStateCallbackType & { hovered?: boolean }).hovered === true
}

/**
 * On native the inner Pressable wins the touch responder, but on RNW a press is a DOM click that bubbles,
 * so a control nested in a pressable row would also fire the row's handler (which runs last and wins).
 * Every nested control calls this first; it is a no-op where the event has no `stopPropagation`.
 */
export function stopPress(event: unknown): void {
  const candidate = event as { stopPropagation?: () => void } | null | undefined
  if (typeof candidate?.stopPropagation === "function") candidate.stopPropagation()
}

/** RN's `CursorValue` is a narrow union while RNW accepts any CSS cursor, so the cursor helpers widen via `unknown`. */
export const webCursorPointer: ViewStyle = isWeb
  ? ({ cursor: "pointer" } as unknown as ViewStyle)
  : {}

export const webCursorDefault: ViewStyle = isWeb
  ? ({ cursor: "default" } as unknown as ViewStyle)
  : {}

export function webCursor(disabled = false): ViewStyle {
  if (!isWeb) return {}
  return disabled ? webCursorDefault : webCursorPointer
}

export const webCursorColResize: ViewStyle = isWeb
  ? ({ cursor: "ew-resize" } as unknown as ViewStyle)
  : {}

/** RNW defaults Text to `user-select: none`, so body content opts back in to be copyable. */
export const webSelectableText: TextStyle = isWeb ? ({ userSelect: "text" } as TextStyle) : {}

/** Button label Text inside a Pressable can inherit selection in some browsers despite RNW's default. */
export const webNoSelect: TextStyle = isWeb ? ({ userSelect: "none" } as TextStyle) : {}

/**
 * An RNW `<TextInput>` is a real DOM input that paints the UA focus outline and, for a textarea, a UA
 * border; our inputs draw their own border and ring, and are not tagged for the focus-ring stylesheet.
 * Spread it first so per-input styles still win. The outline keys are absent from RN's `TextStyle`.
 */
export const webInputReset: TextStyle = isWeb
  ? ({ outlineStyle: "none", outlineWidth: 0, borderWidth: 0 } as unknown as TextStyle)
  : {}

/**
 * Without an explicit timing function the browser falls back to `ease`; using the same constant as
 * `shell/motionCss` keeps every hover and press state on the house curve.
 */
export const webTransition: ViewStyle = isWeb
  ? ({
      transitionProperty: "opacity, background-color, transform",
      transitionDuration: "120ms",
      transitionTimingFunction: EASE_STANDARD_CSS,
    } as ViewStyle)
  : {}

const FOCUS_RING_ATTR = "data-focus-ring"
const FOCUS_STYLE_ID = "civfix-ui-focus-ring"
let focusStyleInjected = false

/**
 * The ring keeps `tokens.shadow.ring`'s footprint ("0 0 0 <w>px <color>"), so no surface that clips at that
 * width clips it harder. The literal is only the fallback for a token reshaped into a form this cannot read.
 */
const RING_SPEC = /^0 0 0 (\d+(?:\.\d+)?)px\s+(.+)$/.exec(tokens.shadow.ring)
const FOCUS_RING_FOOTPRINT = RING_SPEC ? Number(RING_SPEC[1]) : 3

/**
 * The ring is opaque `theme.colors.accentText`, not the token's `rgba(240,104,92,0.30)` fill coral, which
 * composites to 1.32:1 on sand and 1.38:1 on a card against the WCAG 2.4.11 floor of 3:1. Opaque #B03A2C
 * measures 5.26:1 on sand (#F4EFE6) and 5.92:1 on a card (#FFFDF8); `focusRing.test.ts` pins it equal to
 * accentText and recomputes both ratios.
 *
 * The 1px offset keeps the ring legible against the control too (accentText is only 2.83:1 on the ink
 * Search orb and 1.96:1 on the coral New post pill) by spending part of the footprint on the page behind
 * it, and leaves a 2px stroke, the WCAG 2.4.13 minimum thickness.
 */
export const FOCUS_RING_COLOR = "#B03A2C"
export const FOCUS_RING_OFFSET = 1
export const FOCUS_RING_WIDTH = FOCUS_RING_FOOTPRINT - FOCUS_RING_OFFSET
export const FOCUS_RING_OUTLINE = `${FOCUS_RING_WIDTH}px solid ${FOCUS_RING_COLOR}`
export const FOCUS_RING_COLOR_DARK = "#F79185"
export const FOCUS_RING_OUTLINE_DARK = `${FOCUS_RING_WIDTH}px solid ${FOCUS_RING_COLOR_DARK}`
const DARK_ROOT = ":root.dark"

/**
 * An outline, not a box-shadow: RNW writes a shadow it cannot hash as an inline style, which outranks any
 * stylesheet ring, so elevated controls showed no ring at all; an outline composes with the elevation.
 * No `border-radius: inherit` either: it resolves against the parent and squared off round controls,
 * while an outline already follows the element's own radius. No-op on native and SSR.
 */
function ensureFocusRingStyle(): void {
  if (!isWeb || focusStyleInjected) return
  if (typeof document === "undefined") return
  focusStyleInjected = true
  if (document.getElementById(FOCUS_STYLE_ID)) return
  const el = document.createElement("style")
  el.id = FOCUS_STYLE_ID
  el.textContent =
    `[${FOCUS_RING_ATTR}]:focus{outline:none;}` +
    `[${FOCUS_RING_ATTR}]:focus-visible{outline:${FOCUS_RING_OUTLINE};` +
    `outline-offset:${FOCUS_RING_OFFSET}px;}` +
    `${DARK_ROOT} [${FOCUS_RING_ATTR}]:focus-visible{outline:${FOCUS_RING_OUTLINE_DARK};}`
  document.head.appendChild(el)
}

// Injected at module evaluation so the rule exists before the first focus.
ensureFocusRingStyle()

/** RNW maps `dataSet` to `data-*` attributes, so this becomes the `data-focus-ring` the stylesheet targets. */
export const focusRingProps: { dataSet?: Record<string, string> } = isWeb
  ? { dataSet: { focusRing: "" } }
  : {}

/**
 * A modal scrim must not be focusable on web. RNW renders the scrim's role="button" as a real `<button>`,
 * and RNW's `ModalFocusTrap` focuses the first focusable descendant, which parked focus on the invisible
 * scrim on open and on every Tab wrap. `tabindex="-1"` is not enough because a `<button>` stays
 * programmatically focusable: `role: "none"` makes RNW render a presentational div, and `tabIndex: null` is
 * the one value that emits no tabindex, so the div refuses focus. `aria-hidden` and the cleared label keep
 * it out of the a11y tree; pointer handlers are unaffected.
 *
 * Apply it to the scrim element only, never a wrapper (that would hide the dialog's own content), and
 * spread it last: RNW prefers `role` over `accessibilityRole`, and the label must land after the call
 * site's own. Empty on native, where the labelled dismiss button is how VoiceOver reaches it.
 */
export const webScrimProps: object = isWeb
  ? { role: "none", tabIndex: null, "aria-hidden": true, accessibilityLabel: undefined }
  : {}

/**
 * RNW renders every `accessibilityRole="header"` as a bare `<h1>`, so without a level a wordmark, the page
 * title and a section eyebrow all announce as peers. The ladder (pinned by `headingLevels.test.ts`):
 *   1 - the tab-root / stacked-panel title: one per rendered surface, and the only level a body may leave
 *       implicit, because an untagged RNW header already is an `<h1>`.
 *   2 - a section of that surface, whatever its type size (an eyebrow introduces its section).
 *   3 - a sub-label inside one of those sections.
 * `aria-level` overrides the implicit level without changing the tag or any pixel. RN core does not type
 * `aria-*` props, hence the one cast here; native ignores the prop.
 */
export function headingLevel(level: 1 | 2 | 3): object {
  return { "aria-level": level }
}
