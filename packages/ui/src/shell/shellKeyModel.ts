/**
 * The expanded (landscape) shell's KEYBOARD contract - pure, so the one decision each keystroke needs is
 * made in a tested place rather than inside a DOM listener.
 *
 * Landscape is the only civfix layout with a hardware keyboard in front of it, and it gets exactly two
 * shortcuts (design §3.5 / §4.4):
 *
 *   `/`      -> open Search and focus its field. The house shortcut every timeline app carries.
 *   Escape   -> pop the stacked surface. There is nothing else to dismiss: the card is persistent and the
 *               rail, not a modal stack, is how a user changes surface.
 *
 * THE GUARD IS THE FEATURE (§7.9). Both keys are single, unmodified keystrokes, which means `/` is also an
 * ordinary character and Escape is also a field's own cancel - and, while a dialog is up, Escape is the
 * dialog's dismissal. Every branch that lets the shell act in those cases is a bug the user meets by
 * typing. So `editable` and `modalOpen` short-circuit BOTH keys here, in ONE place, and the shell's
 * listener does nothing but ask.
 *
 * THE ESCAPE LADDER HAS TWO OWNERS, deliberately. While a text field has focus the FIELD owns Escape
 * (`searchFieldEscape`: clear the query, then give up focus; `conversationFieldEscape`: drop the reply/edit
 * mode, then give up focus); once focus has left it the SHELL owns the next Escape (`shellKeyAction`: pop, or
 * nothing at a view root). Splitting it this way is what makes "clear -> blur -> back" work as three presses
 * without either owner having to know the other's state, and it is why all three of the card's text surfaces
 * now answer Escape with the same shape: spend the field's own rung, blur, then pop.
 *
 * AND A SURFACE WHOSE FIELD OWNS NOTHING GETS THE FIRST RUNG HERE. The guard has a failure mode: a surface
 * that AUTO-FOCUSES a field on open and has no Escape handler of its own arms the veto permanently, so
 * Escape can never dismiss it at all. The composer is exactly that - it focuses its textarea the moment it
 * opens, and Escape was verified to leave it open forever (blur it by hand and the very next Escape closed
 * it), leaving Tab-to-X as the only keyboard exit. So for those kinds the first Escape spends itself giving
 * up the field (`blur-field`) and the second reaches the rule above and pops - the same clear/blur/back
 * shape the search field already has, minus the rung it has no query to clear. Every other field keeps the
 * veto whole: this is a per-KIND opt-in, not a relaxation of the guard.
 *
 * Pure: no react, no react-native, no DOM types - `isEditableTarget` takes the two fields it actually
 * reads so a unit test can hand it a plain object and the listener can hand it an `Element`.
 */
import type { DetailEntry, DetailKind, View } from "../nav"

/** What a shell-level keystroke resolves to. */
export type ShellKeyAction =
  /** Not ours: a chord, a composition, a keystroke in a field, or any other key. */
  | "none"
  /** Navigate to Search, then focus its field. */
  | "open-search"
  /** Already at the search root - focus the field WITHOUT navigating (see `searchPressOpensSearch`). */
  | "focus-search"
  /** Pop the stacked surface. */
  | "back"
  /**
   * Give up the focused field so the NEXT Escape reaches the shell. The first rung of the ladder for a
   * stacked surface that auto-focuses a field and owns no Escape of its own - see the module header.
   */
  | "blur-field"

/**
 * The stacked surfaces whose first Escape blurs their field instead of being vetoed by it.
 *
 * ONE entry, and it is not a placeholder for "eventually everything": a kind belongs here only when it
 * AUTO-FOCUSES a field on open (so the veto is armed before the user has touched anything) and has no
 * Escape handler of its own (so nothing else is being stolen from). The composer does both. A field the
 * user chose to focus is a field they can Tab or click out of, and a field that owns Escape - the search
 * field - must keep it.
 */
const ESCAPE_BLURS_FIELD: ReadonlySet<DetailEntry["kind"]> = new Set<DetailKind>(["composer"])

export interface ShellKeyInput {
  /** `KeyboardEvent.key`. */
  key: string
  /** True when the keystroke is landing in a text field / contenteditable. THE guard - see the header. */
  editable: boolean
  /** The nav store's current list view. */
  view: View
  /** `stack.length`. Escape pops only what is stacked OVER a view root. */
  stackLength: number
  /**
   * The kind of the ACTIVE stacked entry (`useNavStore.active?.kind`), or null at a view root. Read only to
   * decide whether an Escape landing in a field should spend itself blurring that field - see
   * `ESCAPE_BLURS_FIELD`. Typed as the ENTRY's kind (which includes the transient `"view"` route carrier)
   * so the listener can pass the store's value straight through with no narrowing at the call site.
   */
  activeKind?: DetailEntry["kind"] | null
  /** Any of ctrl / meta / alt: a chord belongs to the browser or the OS, never to the shell. */
  chord?: boolean
  /** True during an IME composition (`KeyboardEvent.isComposing`). */
  composing?: boolean
  /**
   * True while a modal surface is on screen (the auth dialog, a lightbox, an action menu). The TOP surface
   * owns Escape: those dialogs already close themselves on it, so a shell that also popped would spend one
   * keystroke on two navigations - the dialog closing and the surface behind it changing.
   */
  modalOpen?: boolean
}

/** The element types a keystroke could be TEXT for. Upper-cased before comparison (XML/SVG tags are not). */
const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

/**
 * Is this element one the user could be typing into? Takes the two fields it reads rather than an
 * `Element`, so the model stays DOM-free and a test can pass a literal.
 */
export function isEditableTarget(
  target: { tagName?: string | null; isContentEditable?: boolean } | null | undefined,
): boolean {
  if (!target) return false
  if (target.isContentEditable === true) return true
  return EDITABLE_TAGS.has((target.tagName ?? "").toUpperCase())
}

/**
 * Would pressing Search from this state actually LAND on the search root?
 *
 * `useNavStore.selectView` carries the dock's re-tap rule: re-selecting the already-active view with an
 * empty stack DESELECTS it back to home. A focus request armed by such a press would be a one-shot signal
 * with no field to consume it - it would sit in the store and steal focus on the next, unrelated Search
 * entry. The rail's orb and the `/` key both ask this before arming.
 */
export function searchPressOpensSearch(view: View, stackLength: number): boolean {
  return !(view === "search" && stackLength === 0)
}

/** Resolve one shell keystroke. See the module header for why `editable` short-circuits everything. */
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
  // A keystroke in a field is TEXT, with exactly one exception: the first Escape inside a surface that
  // auto-focused that field and answers Escape nowhere else. `/` is never affected - it is a character.
  if (editable) {
    return key === "Escape" && activeKind !== null && ESCAPE_BLURS_FIELD.has(activeKind)
      ? "blur-field"
      : "none"
  }
  if (key === "/") return searchPressOpensSearch(view, stackLength) ? "open-search" : "focus-search"
  if (key === "Escape") return stackLength > 0 ? "back" : "none"
  return "none"
}

/** The search field's own half of the Escape ladder. */
export type SearchFieldEscape = "clear" | "blur"

/** The conversation composer's own half of the ladder: drop the active reply/edit mode, or give up focus. */
export type ConversationFieldEscape = "cancel-mode" | "blur"

/**
 * Escape inside the CONVERSATION composer, so the card's three text surfaces answer one shape.
 *
 * THE SHAPE: spend the press on whatever the field itself still owns, then give the field up; the shell's
 * next Escape (with nothing focused, so `shellKeyAction`'s guard is open) pops. The search field spends its
 * first press clearing the query; the post composer has nothing to clear and goes straight to `blur-field`
 * through `ESCAPE_BLURS_FIELD`; this field's own rung is the active reply/edit mode, and once that is gone it
 * blurs. Before this it answered nothing at all: two presses with the textarea focused left the panel and the
 * caret exactly where they were, so the ONE control in the card carrying a prominent coral focus ring was the
 * one whose Escape was inert, and Tab was the only exit (past a send button that is disabled while empty).
 *
 * WHY THE FIELD OWNS IT AND `ESCAPE_BLURS_FIELD` DOES NOT. Adding "thread" to that set would make the SHELL
 * blur on the same keystroke the composer uses to cancel a reply - `useShellKeys` listens in CAPTURE, so it
 * acts first and `preventDefault()` does not stop the event reaching the field afterwards - and one Escape
 * would do two things. The set also documents a narrower promise (a kind that AUTO-FOCUSES a field and
 * answers Escape nowhere else); a conversation does neither. So the rung lives with the field that has the
 * state, and this pure function is where the decision is made and tested.
 */
export function conversationFieldEscape(composerModeActive: boolean): ConversationFieldEscape {
  return composerModeActive ? "cancel-mode" : "blur"
}

/**
 * Escape inside the search field: clear what is typed, and only give up focus once there is nothing left
 * to clear. The NEXT Escape then reaches the shell (nothing is focused any more), which pops the stack or
 * does nothing at a view root - the full "clear -> blur -> back" ladder of §3.5.
 *
 * The test is on the RAW value, not a trimmed one: whitespace is still text the user can see sitting in
 * the field, and a first Escape that appears to do nothing is worse than one that clears it.
 */
export function searchFieldEscape(query: string): SearchFieldEscape {
  return query.length > 0 ? "clear" : "blur"
}
