/**
 * react-native-web 0.21 drops `accessibilityState` entirely, so a radio, checkbox or disclosure whose state
 * lives only there reaches the DOM with no `aria-checked` / `aria-expanded` at all. `a11yState` returns both
 * forms from one declaration. The primitives import react-native and cannot render under this package's
 * node vitest, so the DOM half renders a bare react-native-web Pressable with the helper's output, and the
 * callers are pinned to spread the helper on the element that carries the role.
 */
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { createElement, type ComponentType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { a11yState } from "../a11yState"

// react-native-web ships no type declarations; only its Pressable is needed here.
const { Pressable } = createRequire(import.meta.url)("react-native-web") as {
  Pressable: ComponentType<Record<string, unknown>>
}

const renderWeb = (props: Record<string, unknown>): string => renderToStaticMarkup(createElement(Pressable, props))

describe("a11yState carries each state to both platforms", () => {
  it("mirrors every set state into the ARIA prop react-native-web renders", () => {
    expect(a11yState({ checked: true, disabled: false })).toEqual({
      accessibilityState: { checked: true, disabled: false },
      "aria-checked": true,
      "aria-disabled": false,
    })
    expect(a11yState({ expanded: false })).toEqual({ accessibilityState: { expanded: false }, "aria-expanded": false })
    expect(a11yState({ selected: true, busy: true })).toEqual({
      accessibilityState: { selected: true, busy: true },
      "aria-selected": true,
      "aria-busy": true,
    })
    expect(a11yState({ checked: "mixed" })["aria-checked"]).toBe("mixed")
  })

  it("emits no ARIA prop for a state the caller did not set", () => {
    expect(Object.keys(a11yState({ disabled: true }))).toEqual(["accessibilityState", "aria-disabled"])
  })

  it("reaches the DOM, where accessibilityState alone does not", () => {
    expect(renderWeb({ accessibilityRole: "radio", accessibilityState: { checked: true } })).not.toContain("aria-checked")
    expect(renderWeb({ accessibilityRole: "radio", ...a11yState({ checked: true }) })).toContain('aria-checked="true"')
    expect(renderWeb({ accessibilityRole: "checkbox", ...a11yState({ checked: false }) })).toContain('aria-checked="false"')
    expect(renderWeb({ accessibilityRole: "button", ...a11yState({ expanded: true }) })).toContain('aria-expanded="true"')
  })
})

const code = (rel: string): string =>
  readFileSync(new URL(rel, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")

function elementWith(source: string, marker: string): string {
  const at = source.indexOf(marker)
  expect(at, marker).toBeGreaterThan(-1)
  const open = source.lastIndexOf("<Pressable", at)
  const close = source.indexOf(">", at)
  expect(open, `<Pressable before ${marker}`).toBeGreaterThan(-1)
  expect(close).toBeGreaterThan(open)
  return source.slice(open, close)
}

describe("state-bearing primitives spread a11yState, not a bare accessibilityState", () => {
  it.each([
    ["../../primitives/ReportContentSheet.tsx", 'accessibilityRole="radio"', "{...a11yState({ checked: selected })}"],
    [
      "../../primitives/FilterChip.tsx",
      "accessibilityRole={SELECTION_ROLE[selection]}",
      '{...a11yState(selection === "action" ? { disabled } : { checked: selected, disabled })}',
    ],
    ["../../primitives/PostOverflowButton.tsx", "accessibilityLabel={label}", "{...a11yState({ expanded })}"],
    ["../../primitives/TermsConfirmation.tsx", 'accessibilityRole="checkbox"', "{...a11yState({ checked: confirmed })}"],
  ])("%s", (file, marker, spread) => {
    const element = elementWith(code(file), marker)
    expect(element).toContain(spread)
    expect(element).not.toContain("accessibilityState=")
  })
})
