/**
 * The expanded (landscape) shell's keyboard contract, kept pure so each keystroke's decision is tested
 * rather than made inside a DOM listener. Two shortcuts: `/` opens Search and focuses its field, Escape
 * pops the stacked surface.
 *
 * The guard is the feature: both are unmodified keystrokes, so `/` is also a character, Escape is also a
 * field's own cancel, and a dialog's dismissal. `editable` and `modalOpen` short-circuit both keys here.
 *
 * Escape has two owners: while a field has focus the field spends its own rung and then blurs; once focus
 * has left, the shell pops. That gives "clear, blur, back" as three presses without either owner knowing
 * the other's state. A surface that auto-focuses a field and has no Escape handler of its own would arm
 * the veto permanently, so for those kinds (`ESCAPE_BLURS_FIELD`) the first Escape blurs the field.
 */
import type { DetailEntry, DetailKind, View } from "../nav"

export type ShellKeyAction =
  | "none"
  | "open-search"
  /** Already at the search root: focus the field without navigating (see `searchPressOpensSearch`). */
  | "focus-search"
  | "back"
  | "blur-field"

/**
 * A kind belongs here only when it auto-focuses a field on open and has no Escape handler of its own. A
 * field the user chose to focus can be tabbed out of, and a field that owns Escape must keep it.
 */
const ESCAPE_BLURS_FIELD: ReadonlySet<DetailEntry["kind"]> = new Set<DetailKind>(["composer"])

export interface ShellKeyInput {
  key: string
  editable: boolean
  view: View
  stackLength: number
  /** Typed as the entry's kind (including the transient `"view"` carrier) so the store value passes through. */
  activeKind?: DetailEntry["kind"] | null
  /** Any of ctrl / meta / alt: a chord belongs to the browser or the OS. */
  chord?: boolean
  composing?: boolean
  /** The top modal already closes itself on Escape; popping too would spend one keystroke on two navigations. */
  modalOpen?: boolean
}

/** Compared upper-cased: XML/SVG tag names are not. */
const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

/** Takes the two fields it reads rather than an `Element`, so the model stays DOM-free. */
export function isEditableTarget(
  target: { tagName?: string | null; isContentEditable?: boolean } | null | undefined,
): boolean {
  if (!target) return false
  if (target.isContentEditable === true) return true
  return EDITABLE_TAGS.has((target.tagName ?? "").toUpperCase())
}

/**
 * `selectView` deselects an already-active view with an empty stack back to home, so a focus request
 * armed by that press would have no field to consume it and would steal focus on the next Search entry.
 */
export function searchPressOpensSearch(view: View, stackLength: number): boolean {
  return !(view === "search" && stackLength === 0)
}

export function shellKeyAction({
  key,
  editable,
  view,
  stackLength,
  chord = false,
  composing = false,
  modalOpen = false,
  activeKind = null,
}: ShellKeyInput): ShellKeyAction {
  if (chord || composing || modalOpen) return "none"
  // A keystroke in a field is text, except the first Escape inside an ESCAPE_BLURS_FIELD surface.
  if (editable) {
    return key === "Escape" && activeKind !== null && ESCAPE_BLURS_FIELD.has(activeKind)
      ? "blur-field"
      : "none"
  }
  if (key === "/") return searchPressOpensSearch(view, stackLength) ? "open-search" : "focus-search"
  if (key === "Escape") return stackLength > 0 ? "back" : "none"
  return "none"
}

export type SearchFieldEscape = "clear" | "blur"

export type ConversationFieldEscape = "cancel-mode" | "blur"

/**
 * The conversation composer owns this rung rather than joining `ESCAPE_BLURS_FIELD`: `useShellKeys`
 * listens in capture, so a shell blur would fire on the same keystroke the composer uses to cancel a
 * reply, and `preventDefault()` does not stop the event reaching the field. One Escape would do two things.
 */
export function conversationFieldEscape(composerModeActive: boolean): ConversationFieldEscape {
  return composerModeActive ? "cancel-mode" : "blur"
}

/**
 * Tests the raw value, not a trimmed one: whitespace is still visible text, and a first Escape that
 * appears to do nothing is worse than one that clears it.
 */
export function searchFieldEscape(query: string): SearchFieldEscape {
  return query.length > 0 ? "clear" : "blur"
}
