/**
 * Web affordances for react-native-web (RNW) - Stage 5B.
 *
 * The shared UI is authored in React Native primitives and rendered on web via RNW. RNW gives Pressables
 * keyboard activation + ARIA from `accessibilityRole`, but it does NOT, on its own, give every control the
 * web affordances a mouse/keyboard user expects: a pointer cursor, a visible keyboard focus ring, a hover
 * state, or selectable body text. This module centralizes those affordances so the primitives opt in with
 * one import and stay PIXEL-IDENTICAL on native.
 *
 * NATIVE-SAFETY: every export is gated on `Platform.OS === "web"`. On native each helper resolves to an
 * empty object / no-op, so importing + spreading them changes nothing on iOS/Android. The style keys used
 * on web (`cursor`, `userSelect`, `transitionProperty`, the `dataSet` focus-ring marker) are RNW-only;
 * native RN ignores `dataSet` and never sees these objects (they are empty there).
 *
 * FOCUS RING: rather than draw a ring on RNW's `focused` flag (which is true for BOTH mouse and keyboard
 * focus, so it would flash on every click), we inject ONE global stylesheet that targets the native CSS
 * `:focus-visible` pseudo-class (the browser's keyboard-vs-pointer heuristic) on elements tagged with the
 * `data-focus-ring` attribute. Interactive primitives spread `focusRingProps` (which RNW maps to that
 * data attribute). Result: keyboard users get a coral ring; mouse users do not. Injected lazily + once.
 */
import { Platform, type ViewStyle, type TextStyle, type PressableStateCallbackType } from "react-native"
import { tokens } from "@civfix/shared/tokens"
import { EASE_STANDARD_CSS } from "./motion"

const isWeb = Platform.OS === "web"

/**
 * react-native-web extends the Pressable style-callback state with `hovered` + `focused` flags that RN's
 * core types do not declare (RN only types `pressed`). `webHover` reads the RNW-only `hovered` flag in
 * ONE typed place (a single cast here) so call sites stay type-clean: a button writes
 * `style={(s) => [..., webHover(s) ? styles.hovered : null]}`. Always `false` on native (the flag is
 * never set there), so a native button never gets the hover style.
 */
export function webHover(state: PressableStateCallbackType): boolean {
  if (!isWeb) return false
  return (state as PressableStateCallbackType & { hovered?: boolean }).hovered === true
}

/**
 * Stop a press from ALSO firing an enclosing Pressable's `onPress`.
 *
 * WHY THIS EXISTS: nested Pressables behave differently on the two platforms. On iOS/Android the inner
 * view wins the touch responder outright, so the outer handler never runs. On react-native-web a press is
 * a DOM click, and clicks BUBBLE - so an inner control inside a pressable row fires BOTH handlers, and the
 * outer (usually a navigation) wins because it runs last. Every nested control must therefore call this
 * first; it is a no-op wherever the event does not carry `stopPropagation`, so native is untouched.
 *
 * The codebase's older answer was to never nest at all (LinkedEventCard makes its RSVP pill a SIBLING of
 * the pressable card). That works when the control can be lifted out of the row; it cannot when the row
 * itself is the primary target and the control sits visually inside it - which is exactly the timeline
 * post row, where the whole row opens the thread but the name, handle, timestamp and overflow menu each
 * do something else.
 */
export function stopPress(event: unknown): void {
  const candidate = event as { stopPropagation?: () => void } | null | undefined
  if (typeof candidate?.stopPropagation === "function") candidate.stopPropagation()
}

/**
 * `cursor: pointer` for an interactive control on web (RNW forwards the `cursor` key to the DOM). Empty
 * on native. Spread into the resting style of any Pressable that fires `onPress`. (RN's `CursorValue`
 * type is a narrow union; RNW accepts any CSS cursor, so we widen via `unknown`.)
 */
export const webCursorPointer: ViewStyle = isWeb
  ? ({ cursor: "pointer" } as unknown as ViewStyle)
  : {}

/**
 * `cursor: default` for a DISABLED control (so a disabled button does not show the click cursor). Empty
 * on native. Spread (after `webCursorPointer`) when the control is disabled.
 */
export const webCursorDefault: ViewStyle = isWeb
  ? ({ cursor: "default" } as unknown as ViewStyle)
  : {}

/**
 * Resolve the right cursor for an interactive control by disabled-state. `pointer` when actionable,
 * `default` when disabled. Empty on native.
 */
export function webCursor(disabled = false): ViewStyle {
  if (!isWeb) return {}
  return disabled ? webCursorDefault : webCursorPointer
}

/**
 * `cursor: ew-resize` (the horizontal double-arrow) for a left/right drag affordance such as the sidebar
 * resize handle, so a web user reads the edge as draggable. Empty on native (the touch drag needs no
 * cursor). Same `unknown` widen as the other cursor helpers (RNW accepts any CSS cursor).
 */
export const webCursorColResize: ViewStyle = isWeb
  ? ({ cursor: "ew-resize" } as unknown as ViewStyle)
  : {}

/**
 * Make TEXT user-selectable on web (RNW defaults Text to `user-select: none`). Spread onto body content
 * Text (messages, descriptions, titles) so a web reader can select/copy it. Empty on native (RN Text is
 * not selectable and has no such concept; use the `selectable` prop there if ever needed).
 */
export const webSelectableText: TextStyle = isWeb ? ({ userSelect: "text" } as TextStyle) : {}

/**
 * Keep a control's label NON-selectable on web (so dragging across a button does not highlight its text).
 * RNW already defaults Text to none, but button label Text inside a Pressable can inherit selection in
 * some browsers; spread this to be explicit. Empty on native.
 */
export const webNoSelect: TextStyle = isWeb ? ({ userSelect: "none" } as TextStyle) : {}

/**
 * Strip the browser User-Agent chrome from an RNW text input on web. A React Native `<TextInput>` renders
 * a real DOM `<input>`/`<textarea>`, which paints the UA `:focus` outline (a dark/blue ring) and, for a
 * bare `<textarea>`, a UA border - the "black box around the form field". Our inputs draw their own light
 * border (on a wrapping View) and their own coral focus ring, so the UA chrome is pure noise. Unlike the
 * Pressable focus ring (which routes through the `[data-focus-ring]` stylesheet), inputs are not tagged,
 * so they need this explicit reset. Spread FIRST into the input's style so any per-input style still wins.
 * Empty on native (RN `<TextInput>` has no `outline` concept; the keys are RNW-only). The `outlineStyle`/
 * `outlineWidth` keys are RNW-recognized but absent from RN's `TextStyle`, so we widen via `unknown` like
 * the cursor helpers above.
 */
export const webInputReset: TextStyle = isWeb
  ? ({ outlineStyle: "none", outlineWidth: 0, borderWidth: 0 } as unknown as TextStyle)
  : {}

/**
 * A subtle CSS transition so hover/press color changes ease instead of snapping, on web only. Spread into
 * a button's resting style. Empty on native (RN animates via Animated/reanimated, not CSS transitions).
 *
 * THE CURVE IS NOT OPTIONAL. Setting only `transitionProperty` + `transitionDuration` leaves the browser on
 * its `ease` default, so the app's single most-repeated transition - every hover and press state in the
 * shell - was the ONE thing not running the house curve, next to body swaps and card motion that do
 * (`shell/motionCss` emits `EASE_STANDARD_CSS` on every clause). Same constant, so the two can never drift.
 */
export const webTransition: ViewStyle = isWeb
  ? ({
      transitionProperty: "opacity, background-color, transform",
      transitionDuration: "120ms",
      transitionTimingFunction: EASE_STANDARD_CSS,
    } as ViewStyle)
  : {}

/* --------------------------------------------------------------------------------------------- *
 * Focus-visible ring (keyboard-only) via a one-time global stylesheet.
 * --------------------------------------------------------------------------------------------- */

const FOCUS_RING_ATTR = "data-focus-ring"
const FOCUS_STYLE_ID = "civfix-ui-focus-ring"
let focusStyleInjected = false

/**
 * THE RING'S FOOTPRINT is still `tokens.shadow.ring`'s ("0 0 0 <w>px <color>"), so the band a keyboard user
 * sees occupies the same 3px immediately outside the border box that the box-shadow ring always did, and no
 * surface that clips at 3px clips any harder. Only the fallback is a literal, for a token reshaped into a
 * form this cannot read.
 */
const RING_SPEC = /^0 0 0 (\d+(?:\.\d+)?)px\s+(.+)$/.exec(tokens.shadow.ring)
const FOCUS_RING_FOOTPRINT = RING_SPEC ? Number(RING_SPEC[1]) : 3

/**
 * THE RING'S INK IS `accentText`, NOT THE FILL CORAL - AND IT IS OPAQUE.
 *
 * The token's own color is `rgba(240,104,92,0.30)`: 30% of the FILL coral. Composited, that band measures
 * 1.32:1 against the sand paper, 1.38:1 against a card and 1.36:1 against the rail's glass - i.e. the ring
 * the whole focus rework was built around never cleared 1.4:1 anywhere in the shell, against a WCAG 2.4.11
 * floor of 3:1, and at 1.12:1 over a selected rail lozenge it is gone on any dim or glare-lit display.
 *
 * `#B03A2C` is `theme.colors.accentText` - the SAME coral, darkened until it clears AA as ink on all three
 * civfix surfaces, and the token §6 already mandates for coral text. As an opaque outline it measures
 * 5.26:1 on sand (#F4EFE6) and 5.92:1 on a card (#FFFDF8) - both well past 3:1 - while staying
 * unmistakably in the coral family rather than becoming a second accent. It is a literal here rather than
 * an import because `theme/index` re-exports THIS module (importing it back would close a module cycle);
 * `theme/__tests__/focusRing.test.ts` pins the two strings equal, and computes both ratios, so neither the
 * ink nor the floor can drift silently.
 *
 * THE 1px GAP is what makes the ring legible against the CONTROL as well as against the page. Opaque
 * accentText is 2.83:1 against the ink-filled Search orb and 1.96:1 against the coral New post pill, so a
 * zero-offset band would butt straight onto a surface it barely separates from. `outline-offset` spends 1px
 * of the SAME 3px footprint on the page behind the control, which is always one of the surfaces the ring
 * already clears by 4.8:1+, and leaves a 2px stroke - still at/above the 2px minimum thickness WCAG 2.4.13
 * asks of a focus indicator. Net: the band reads at >= 3:1 on both sides, everywhere, at no extra size.
 */
export const FOCUS_RING_COLOR = "#B03A2C"
/** Gap between the control's border box and the ring stroke, in px (spent from the footprint above). */
export const FOCUS_RING_OFFSET = 1
/** The stroke itself: the footprint minus the gap. */
export const FOCUS_RING_WIDTH = FOCUS_RING_FOOTPRINT - FOCUS_RING_OFFSET
export const FOCUS_RING_OUTLINE = `${FOCUS_RING_WIDTH}px solid ${FOCUS_RING_COLOR}`
export const FOCUS_RING_COLOR_DARK = "#F79185"
export const FOCUS_RING_OUTLINE_DARK = `${FOCUS_RING_WIDTH}px solid ${FOCUS_RING_COLOR_DARK}`
const DARK_ROOT = ":root.dark"

/**
 * Inject (once) the global `:focus-visible` ring rule for `[data-focus-ring]` elements. `outline: none` on
 * plain `:focus` removes the UA's default ring for mouse focus; `:focus-visible` then paints ours.
 *
 * WHY AN OUTLINE AND NOT A BOX-SHADOW (and why the rule no longer says `border-radius: inherit`). The rule
 * used to draw the ring as `box-shadow: tokens.shadow.ring` plus `border-radius: inherit`, and both halves
 * were wrong on the controls that most need a focus indicator:
 *
 *   - `border-radius: inherit` resolves against the PARENT, not the element. The rail's 58Ø Search orb sits
 *     in a radius-0 cluster, so focusing it squared the circle off (29px -> 0px); the coral New post pill
 *     (999) and every 40Ø avatar in the feed went rectangular the same way. 18 of the 53 ringed elements on
 *     the landscape home screen were mis-shaped by it. Every primitive already owns its radius, and an
 *     outline follows that radius natively - so the declaration has no job left.
 *   - a box-shadow ring LOSES to the element's own elevation. react-native-web writes a shadow whose value
 *     it cannot hash into an atomic class as an INLINE style, and no stylesheet rule outranks an inline
 *     declaration without `!important` - which would in turn ERASE the elevation while focused. So the
 *     Search orb and the map float's Locate / Layers / Activity buttons painted no ring at all, and since
 *     `outline: none` had already suppressed the UA fallback they had NO visible keyboard focus indicator
 *     whatsoever (WCAG 2.4.7). `outline` is a different property from `box-shadow`: it composes with the
 *     elevation instead of fighting it, from one rule, with no per-primitive focused style to keep in sync.
 *
 * No-op on native and SSR (guards on `document`).
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

// Inject at module-eval time on web so the rule exists before the first focus. Guarded for SSR.
ensureFocusRingStyle()

/**
 * Props that tag an interactive primitive so it shows the keyboard-only focus ring on web. RNW maps
 * `dataSet` -> `data-*` attributes, so this becomes `data-focus-ring=""`, which the injected stylesheet's
 * `:focus-visible` rule targets. On native `dataSet` is ignored, so this is inert. Spread onto the
 * Pressable: `<Pressable {...focusRingProps} ... />`.
 */
export const focusRingProps: { dataSet?: Record<string, string> } = isWeb
  ? { dataSet: { focusRing: "" } }
  : {}

/**
 * A MODAL SCRIM IS NOT A TAB STOP.
 *
 * Every dialog / sheet / menu in the package draws its dismiss-on-outside-tap as a full-bleed sibling
 * `<Pressable accessibilityRole="button" accessibilityLabel="Dismiss">`. On native that is exactly right:
 * it is the only way a VoiceOver user can reach "tap outside to close". On WEB react-native-web turns the
 * same declaration into a viewport-sized `<button>` - so every scrim in the package was a KEYBOARD STOP
 * that (a) paints no focus ring, because a scrim is not a ringed primitive, and (b) sits BEFORE the dialog
 * it dims, so Tab into an open dialog landed on an invisible full-screen rectangle first and a keyboard
 * user could not tell where focus had gone. It also duplicates a job the web already has a key for:
 * `useDialogWebKeys` closes on Escape.
 *
 * WHY THIS IS THREE PROPS AND NOT JUST `tabIndex: -1` / `focusable={false}`. Both of those land on
 * `tabindex="-1"`, and `tabindex="-1"` is NOT enough here, for two compounding reasons:
 *
 *   1. RNW renders `accessibilityRole="button"` as a real `<button>` element, and a `<button>` is
 *      focusable by construction - `tabindex="-1"` only removes it from the SEQUENTIAL order, it stays
 *      programmatically focusable.
 *   2. RNW's own `<Modal>` wraps its children in `ModalFocusTrap`, whose `focusFirstDescendant` walks the
 *      modal subtree calling `element.focus()` and stops at the first node that becomes `activeElement`.
 *      The scrim is the modal root's FIRST child, so the trap parked focus on it on open and again every
 *      time Tab wrapped - measured as an endless `scrim -> Close -> scrim -> Close` cycle in which the
 *      dialog's own fields were never reached at all.
 *
 * So the scrim has to stop being FOCUSABLE, not merely stop being sequentially focusable. `role: "none"`
 * makes RNW emit a plain `<div role="presentation">` instead of a `<button>`, and `tabIndex: null` is the
 * one value that makes RNW's `createDOMProps` emit no `tabindex` attribute at all (it short-circuits on
 * `0`/`-1`, then only adds one for natively-focusable element types or focusable ARIA roles - a
 * presentational div is neither). A div with no tabindex refuses `.focus()`, so the trap walks straight
 * past it to the dialog's first real control. `aria-hidden` then takes the node out of the a11y tree, and
 * dropping the label keeps a presentational node from carrying an accessible name.
 *
 * Press-to-dismiss is untouched: RNW attaches the Pressable's click/pointer handlers to the DOM node
 * whatever tag it is, and neither `aria-hidden` nor a missing tabindex affects pointer events.
 *
 * ONLY THE SCRIM ELEMENT, never a wrapper. `importantForAccessibility="no-hide-descendants"` (or an
 * `aria-hidden` hoisted onto the modal root) would take the DIALOG's own content out of the tree with it,
 * which is the far worse bug. Each scrim is already authored as a SIBLING of the card, so hiding the one
 * node hides exactly one node.
 *
 * SPREAD IT LAST. `role` beats `accessibilityRole` in RNW (`props.role || props.accessibilityRole`), and
 * `accessibilityLabel: undefined` has to land after the call site's own label to clear it.
 *
 * Empty on native, so iOS/Android keep the labelled, reachable dismiss button they need.
 */
export const webScrimProps: object = isWeb
  ? { role: "none", tabIndex: null, "aria-hidden": true, accessibilityLabel: undefined }
  : {}

/* --------------------------------------------------------------------------------------------- *
 * Heading LEVEL, alongside heading ROLE.
 * --------------------------------------------------------------------------------------------- */

/**
 * Give an `accessibilityRole="header"` element a heading LEVEL.
 *
 * WHY: react-native-web renders `accessibilityRole="header"` as a bare `<h1>` - every time, at every size.
 * The visual hierarchy is well-formed (32 / 22 / 20 / 19 / 11), but the semantics were flat: /search alone
 * exposed SIX h1s at four type sizes ("civfix" 16px brand pill, "Search" 32px tab root, and four 20px
 * section labels), /profile five (an 11px "POSTS" eyebrow through the 22px display name). A screen-reader
 * user navigating by heading got a list in which a decorative wordmark, the page title and a section
 * eyebrow were peers - and the brand pill, which is a BUTTON, announced as the first heading on every
 * route.
 *
 * THE HIERARCHY THIS ENCODES (one per surface, checked by `headingLevels.test.ts`):
 *   1 - the tab-root / stacked-panel title. Exactly one per rendered surface, and the ONLY level a body
 *       may leave implicit, because an untagged RNW header already IS an <h1>.
 *   2 - a section of that surface, whatever its type size: "Suggested people" and "Events in your area"
 *       (20px), the profile's display name under the panel's own "You" (22px), the profile's "POSTS" /
 *       "ACTIVITY" eyebrows and the prefs groups (11px). An eyebrow is a section TITLE that happens to be
 *       set small - it introduces the section, so it is a level 2.
 *   3 - a sub-label INSIDE one of those sections (the profile events section's "Hosting (3)" subhead).
 *
 * `aria-level` on an `<h1>` overrides the implicit level for assistive tech (ARIA in HTML), so the DOM tag
 * does not have to change and NO pixel moves - this is a pure semantics fix. RN core does not type the
 * `aria-*` props, hence the single cast here rather than one at each of ~30 call sites; native ignores the
 * unknown prop, so iOS/Android are untouched.
 */
export function headingLevel(level: 1 | 2 | 3): object {
  return { "aria-level": level }
}
