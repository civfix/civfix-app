/**
 * `/` and Escape are unmodified keys, so they are also ordinary characters and a text field's cancel;
 * the "a field is focused" case is pinned first and hardest. Escape is split between the field (its own
 * rung, then blur) and the shell (the pop once focus has left), and every half is pinned so the seam
 * cannot drift into a double action or a dead key.
 */
import { describe, expect, it } from "vitest"
import {
  conversationFieldEscape,
  isEditableTarget,
  searchFieldEscape,
  searchPressOpensSearch,
  shellKeyAction,
} from "../shellKeyModel"
import type { ShellKeyInput } from "../shellKeyModel"

/** Nothing focused, at the home view root. */
function press(over: Partial<ShellKeyInput> = {}): ShellKeyInput {
  return { key: "/", editable: false, view: "home", stackLength: 0, ...over }
}

describe("isEditableTarget", () => {
  it("recognises every element a keystroke could be TEXT for", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true)
    expect(isEditableTarget({ tagName: "TEXTAREA" })).toBe(true)
    expect(isEditableTarget({ tagName: "SELECT" })).toBe(true)
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true)
  })

  it("normalises the tag case rather than trusting one DOM's spelling", () => {
    // `Element.tagName` is upper-case for HTML but not for XML/SVG content, and a test double is free to
    // hand over either. A guard that only matched "INPUT" would silently let `/` eat a keystroke.
    expect(isEditableTarget({ tagName: "input" })).toBe(true)
    expect(isEditableTarget({ tagName: "TextArea" })).toBe(true)
  })

  it("leaves the ordinary shell targets alone", () => {
    expect(isEditableTarget({ tagName: "DIV" })).toBe(false)
    expect(isEditableTarget({ tagName: "BUTTON" })).toBe(false)
    expect(isEditableTarget({ tagName: "BODY" })).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
    expect(isEditableTarget({})).toBe(false)
  })
})

describe("shellKeyAction: the focused-field guard", () => {
  it("NEVER acts while the keystroke is landing in a field - `/` is a character there", () => {
    expect(shellKeyAction(press({ key: "/", editable: true }))).toBe("none")
    // Escape included: the search field owns its own clear-then-blur ladder (searchFieldEscape), and a
    // shell `back()` firing on the same keystroke would pop the stack out from under it.
    expect(shellKeyAction(press({ key: "Escape", editable: true, stackLength: 2 }))).toBe("none")
  })

  it("never steals a browser or OS chord", () => {
    expect(shellKeyAction(press({ key: "/", chord: true }))).toBe("none")
    expect(shellKeyAction(press({ key: "Escape", stackLength: 2, chord: true }))).toBe("none")
  })

  it("stands down during an IME composition", () => {
    // Escape dismisses a candidate window; `/` can be a composition character. Neither is ours mid-compose.
    expect(shellKeyAction(press({ key: "/", composing: true }))).toBe("none")
    expect(shellKeyAction(press({ key: "Escape", stackLength: 2, composing: true }))).toBe("none")
  })

  it("yields to an open modal - the top surface owns Escape, and `/` must not navigate behind it", () => {
    // The auth dialog closes itself on Escape; popping too would also change the surface behind it.
    expect(shellKeyAction(press({ key: "Escape", stackLength: 2, modalOpen: true }))).toBe("none")
    expect(shellKeyAction(press({ key: "/", modalOpen: true }))).toBe("none")
  })

  it("ignores every other key", () => {
    for (const key of ["a", "?", "Enter", "ArrowLeft", "Tab", " "]) {
      expect(shellKeyAction(press({ key, stackLength: 3 })), key).toBe("none")
    }
  })
})

describe("shellKeyAction: the composer's first Escape gives up its own field", () => {
  // The composer auto-focuses its textarea and answers Escape nowhere, so a whole-guard veto would mean
  // Escape could never dismiss it. The first press blurs; the second reaches the `back` rung.
  it("blurs the field on the FIRST Escape, and only for the kinds that opted in", () => {
    expect(
      shellKeyAction(press({ key: "Escape", editable: true, stackLength: 1, activeKind: "composer" })),
    ).toBe("blur-field")
  })

  it("pops on the SECOND Escape, once the field has given up focus", () => {
    expect(
      shellKeyAction(press({ key: "Escape", editable: false, stackLength: 1, activeKind: "composer" })),
    ).toBe("back")
  })

  it("leaves the veto whole for every other surface's fields", () => {
    // The search field owns clear-then-blur itself, and a report/event form's fields are fields the user
    // chose to focus - both must keep answering "none" so nothing is stolen from them.
    expect(
      shellKeyAction(press({ key: "Escape", editable: true, stackLength: 1, activeKind: "thread" })),
    ).toBe("none")
    expect(
      shellKeyAction(press({ key: "Escape", editable: true, stackLength: 2, activeKind: "create-cleanup" })),
    ).toBe("none")
    expect(shellKeyAction(press({ key: "Escape", editable: true, view: "search" }))).toBe("none")
  })

  it("still never touches `/` in the composer's field - it is a character there", () => {
    expect(
      shellKeyAction(press({ key: "/", editable: true, stackLength: 1, activeKind: "composer" })),
    ).toBe("none")
  })

  it("keeps the chord / composition / modal short-circuits AHEAD of the blur rung", () => {
    // A modal over the composer owns Escape outright, and neither a chord nor an IME candidate window is
    // ever the shell's - the opt-in is a narrower guard, not a way around the wider ones.
    const composer = { key: "Escape", editable: true, stackLength: 1, activeKind: "composer" } as const
    expect(shellKeyAction(press({ ...composer, modalOpen: true }))).toBe("none")
    expect(shellKeyAction(press({ ...composer, chord: true }))).toBe("none")
    expect(shellKeyAction(press({ ...composer, composing: true }))).toBe("none")
  })
})

describe('shellKeyAction: "/" opens or focuses Search', () => {
  it("navigates to Search from anywhere else", () => {
    expect(shellKeyAction(press({ view: "home" }))).toBe("open-search")
    expect(shellKeyAction(press({ view: "map" }))).toBe("open-search")
    expect(shellKeyAction(press({ view: "messaging", stackLength: 1 }))).toBe("open-search")
  })

  it("only FOCUSES when Search is already the root - navigating there would deselect it", () => {
    expect(shellKeyAction(press({ view: "search", stackLength: 0 }))).toBe("focus-search")
    // A detail stacked over Search is not the root: `/` returns to it (and clears the stack) as it would
    // from any other surface.
    expect(shellKeyAction(press({ view: "search", stackLength: 1 }))).toBe("open-search")
  })
})

describe("shellKeyAction: Escape pops only a stacked surface", () => {
  it("pops whenever something is stacked over the view root", () => {
    expect(shellKeyAction(press({ key: "Escape", stackLength: 1 }))).toBe("back")
    expect(shellKeyAction(press({ key: "Escape", stackLength: 4, view: "search" }))).toBe("back")
  })

  it("does NOTHING at a view root - there is no dismissal to make in a persistent card", () => {
    // The landscape card has no dismiss gesture and the rail moves between views, so Escape at a view
    // root has no honest meaning.
    expect(shellKeyAction(press({ key: "Escape", stackLength: 0 }))).toBe("none")
    expect(shellKeyAction(press({ key: "Escape", stackLength: 0, view: "search" }))).toBe("none")
  })
})

describe("searchPressOpensSearch", () => {
  it("is false exactly where `selectView` would deselect instead of navigate", () => {
    // The one-shot focus signal must not be armed by a press that lands on HOME: with no field to consume
    // it, it would sit in the store and steal focus on the next, unrelated Search entry.
    expect(searchPressOpensSearch("search", 0)).toBe(false)
    expect(searchPressOpensSearch("search", 1)).toBe(true)
    expect(searchPressOpensSearch("home", 0)).toBe(true)
    expect(searchPressOpensSearch("map", 0)).toBe(true)
  })
})

describe("searchFieldEscape: the field's own half of the ladder", () => {
  it("clears a non-empty query before it gives up focus", () => {
    expect(searchFieldEscape("park")).toBe("clear")
    // Whitespace is still text the user can see in the field, so the first Escape clears it.
    expect(searchFieldEscape("  ")).toBe("clear")
  })

  it("blurs once there is nothing left to clear, handing the next Escape to the shell", () => {
    expect(searchFieldEscape("")).toBe("blur")
  })
})

describe("conversationFieldEscape: the chat composer's own half of the ladder", () => {
  it("spends the first press on the active reply/edit mode", () => {
    expect(conversationFieldEscape(true)).toBe("cancel-mode")
  })

  it("blurs when there is no mode left, so the shell's NEXT Escape pops the panel", () => {
    // Without this rung the shell could never act: its `editable` guard is armed by the focused textarea.
    expect(conversationFieldEscape(false)).toBe("blur")
  })

  it("is the FIELD's rung - the conversation never joins ESCAPE_BLURS_FIELD", () => {
    // `useShellKeys` listens in CAPTURE, so a shell-side blur would land on the SAME keystroke the composer
    // uses to cancel a reply (preventDefault does not stop the event reaching the field). One press, two
    // actions. The model therefore keeps vetoing shell Escapes from inside a thread's fields.
    const inThreadField = { key: "Escape", editable: true, stackLength: 1, activeKind: "thread" } as const
    expect(shellKeyAction(press(inThreadField))).toBe("none")
    expect(shellKeyAction(press({ ...inThreadField, editable: false }))).toBe("back")
  })
})
