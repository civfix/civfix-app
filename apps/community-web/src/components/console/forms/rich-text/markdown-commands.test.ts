import { parseMarkdownSubset } from "@civfix/shared/markdown"
import { describe, expect, it } from "vitest"

import {
  insertLink,
  isInsertableLinkHref,
  toggleBold,
  toggleBulletList,
  toggleItalic,
  toggleOrderedList,
} from "./markdown-commands"

function sel(value: string, start: number, end: number) {
  return { value, start, end }
}

describe("markdown commands", () => {
  it("wraps a selection in bold and keeps it selected", () => {
    const result = toggleBold(sel("hello world", 0, 5))
    expect(result.value).toBe("**hello** world")
    expect(result.value.slice(result.start, result.end)).toBe("hello")
  })

  it("unwraps bold when the markers sit INSIDE the selection", () => {
    const result = toggleBold(sel("**hello** world", 0, 9))
    expect(result.value).toBe("hello world")
  })

  it("unwraps bold when the markers sit OUTSIDE the selection", () => {
    const result = toggleBold(sel("**hello** world", 2, 7))
    expect(result.value).toBe("hello world")
    expect(result.value.slice(result.start, result.end)).toBe("hello")
  })

  it("toggles italic with the underscore marker", () => {
    expect(toggleItalic(sel("hi", 0, 2)).value).toBe("_hi_")
    expect(toggleItalic(sel("_hi_", 0, 4)).value).toBe("hi")
  })

  it("wraps an empty selection so typing continues inside the markers", () => {
    const result = toggleBold(sel("", 0, 0))
    expect(result.value).toBe("****")
    expect(result.start).toBe(2)
    expect(result.end).toBe(2)
  })

  it("turns lines into a bullet list and back", () => {
    const listed = toggleBulletList(sel("one\ntwo", 0, 7))
    expect(listed.value).toBe("- one\n- two")
    expect(toggleBulletList(sel(listed.value, 0, listed.value.length)).value).toBe("one\ntwo")
  })

  it("numbers an ordered list and converts from bullets", () => {
    expect(toggleOrderedList(sel("- one\n- two", 0, 11)).value).toBe("1. one\n2. two")
  })

  it("inserts an https link with the selection as its label", () => {
    const result = insertLink(sel("civfix", 0, 6), "https://civfix.org")
    expect(result?.value).toBe("[civfix](https://civfix.org)")
    expect(result?.value.slice(result.start, result.end)).toBe("civfix")
  })

  it("uses the url as the label when nothing is selected", () => {
    expect(insertLink(sel("", 0, 0), "https://civfix.org")?.value).toBe(
      "[https://civfix.org](https://civfix.org)",
    )
  })

  it("REJECTS every non-https scheme, including javascript:", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)  ",
      "data:text/html,<script>",
      "http://civfix.org",
      "//civfix.org",
      "vbscript:x",
      "https://civfix.org with space",
      "https://civfix.org)(",
      "",
    ]) {
      expect(isInsertableLinkHref(href), href).toBe(false)
      expect(insertLink(sel("x", 0, 1), href), href).toBeNull()
    }
  })

  it("accepts a plain https url", () => {
    expect(isInsertableLinkHref("https://civfix.org/e/creek-sweep")).toBe(true)
  })

  it("produces source the shared parser accepts, so the preview matches the editor", () => {
    const bolded = toggleBold(sel("hello", 0, 5))
    const [node] = parseMarkdownSubset(bolded.value)
    expect(node?.type).toBe("paragraph")
    expect(node?.type === "paragraph" && node.children[0]?.type).toBe("strong")
  })
})
