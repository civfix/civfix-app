import { describe, expect, it } from "vitest"
import {
  MARKDOWN_MAX_HREF_CHARS,
  MARKDOWN_MAX_LIST_ITEMS,
  MARKDOWN_SUBSET_MAX_CHARS,
  isSafeHttpsUrl,
  isSafeMarkdownHref,
  markdownToPlainText,
  parseMarkdownSubset,
  unsafeHostReason,
} from "../index.js"
import type { MarkdownInline, MarkdownNode } from "../ast.js"

function text(nodes: readonly MarkdownInline[]): string {
  return nodes
    .map((node) => (node.type === "text" ? node.value : text(node.children)))
    .join("")
}

function first(nodes: MarkdownNode[]): MarkdownNode {
  const node = nodes[0]
  if (node === undefined) throw new Error("expected at least one block")
  return node
}

describe("parseMarkdownSubset blocks", () => {
  it("splits paragraphs on blank lines and joins soft breaks", () => {
    const nodes = parseMarkdownSubset("one\ntwo\n\nthree")
    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toEqual({ type: "paragraph", children: [{ type: "text", value: "one two" }] })
    expect(nodes[1]).toEqual({ type: "paragraph", children: [{ type: "text", value: "three" }] })
  })

  it("parses unordered and ordered lists as separate blocks", () => {
    const nodes = parseMarkdownSubset("- a\n- b\n\n1. x\n2. y")
    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toMatchObject({ type: "list", ordered: false })
    expect(nodes[1]).toMatchObject({ type: "list", ordered: true })
    const unordered = nodes[0]
    if (unordered?.type !== "list") throw new Error("expected a list")
    expect(unordered.items.map((item) => text(item.children))).toEqual(["a", "b"])
  })

  it("starts a new list when the marker kind changes", () => {
    const nodes = parseMarkdownSubset("- a\n1. b")
    expect(nodes.map((n) => n.type)).toEqual(["list", "list"])
  })

  it("normalizes CRLF and strips control characters", () => {
    const nodes = parseMarkdownSubset("a\r\n\r\nbc")
    expect(nodes).toHaveLength(2)
    expect(first(nodes)).toEqual({ type: "paragraph", children: [{ type: "text", value: "a" }] })
    expect(nodes[1]).toEqual({ type: "paragraph", children: [{ type: "text", value: "bc" }] })
  })

  it("bounds input, block count and list length", () => {
    expect(MARKDOWN_SUBSET_MAX_CHARS).toBe(8000)
    const huge = "a\n\n".repeat(5000)
    expect(parseMarkdownSubset(huge).length).toBeLessThanOrEqual(200)
    const longList = Array.from({ length: 400 }, (_, i) => `- item ${i}`).join("\n")
    const list = first(parseMarkdownSubset(longList, { maxChars: 20000 }))
    if (list.type !== "list") throw new Error("expected a list")
    expect(list.items).toHaveLength(MARKDOWN_MAX_LIST_ITEMS)
    expect(parseMarkdownSubset("hello world", { maxChars: 5 })).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "hello" }] },
    ])
  })

  it("drops the continuation lines of a list item cut by the cap", () => {
    const items = Array.from({ length: MARKDOWN_MAX_LIST_ITEMS }, (_, i) => `- item ${i}`)
    const src = [...items, "- dropped", "  dropped continuation"].join("\n")
    const list = first(parseMarkdownSubset(src, { maxChars: 20000 }))
    if (list.type !== "list") throw new Error("expected a list")
    expect(list.items).toHaveLength(MARKDOWN_MAX_LIST_ITEMS)
    const last = list.items[MARKDOWN_MAX_LIST_ITEMS - 1]
    expect(last && text(last.children)).toBe(`item ${MARKDOWN_MAX_LIST_ITEMS - 1}`)
  })

  it("still folds continuation lines into a kept list item", () => {
    const list = first(parseMarkdownSubset("- first\n  more\n- second"))
    if (list.type !== "list") throw new Error("expected a list")
    expect(list.items.map((item) => text(item.children))).toEqual(["first more", "second"])
  })

  it("returns an empty AST for empty or non-string input", () => {
    expect(parseMarkdownSubset("")).toEqual([])
    expect(parseMarkdownSubset("   \n\n  ")).toEqual([])
    expect(parseMarkdownSubset(null as unknown as string)).toEqual([])
  })
})

describe("parseMarkdownSubset inline", () => {
  it("parses strong, em and nested emphasis", () => {
    const node = first(parseMarkdownSubset("**bold _inner_** and *ital*"))
    if (node.type !== "paragraph") throw new Error("expected a paragraph")
    expect(node.children[0]).toMatchObject({ type: "strong" })
    const strong = node.children[0]
    if (strong?.type !== "strong") throw new Error("expected strong")
    expect(strong.children.some((child) => child.type === "em")).toBe(true)
    expect(node.children.some((child) => child.type === "em")).toBe(true)
  })

  it("leaves unmatched delimiters literal", () => {
    expect(text((first(parseMarkdownSubset("**not closed")) as { children: MarkdownInline[] }).children)).toBe(
      "**not closed",
    )
    expect(text((first(parseMarkdownSubset("a * b _ c")) as { children: MarkdownInline[] }).children)).toBe(
      "a * b _ c",
    )
  })

  it("honours backslash escapes", () => {
    const node = first(parseMarkdownSubset("\\*literal\\* \\[x\\]"))
    if (node.type !== "paragraph") throw new Error("expected a paragraph")
    expect(node.children).toEqual([{ type: "text", value: "*literal* [x]" }])
  })

  it("keeps https links and validates them at parse time", () => {
    const node = first(parseMarkdownSubset("[map](https://civfix.org/e/creek)"))
    if (node.type !== "paragraph") throw new Error("expected a paragraph")
    expect(node.children[0]).toEqual({
      type: "link",
      href: "https://civfix.org/e/creek",
      children: [{ type: "text", value: "map" }],
    })
  })

  it("degrades an unsafe href to plain text", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>x</script>",
      "//evil.example/x",
      "http://civfix.org",
      "https://user:pw@evil.example/x",
      "https:// spaced.example/x",
      "https://",
    ]) {
      const node = first(parseMarkdownSubset(`[click](${href})`))
      if (node.type !== "paragraph") throw new Error("expected a paragraph")
      expect(node.children.some((child) => child.type === "link")).toBe(false)
      expect(text(node.children)).toBe("click")
    }
  })

  it("never emits HTML for an XSS payload", () => {
    const payloads = [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "[a](javascript:alert(document.cookie))",
      "**<svg/onload=alert(1)>**",
      "]]>&lt;",
      "[[[[[[[[[[",
      "*".repeat(300),
      "[x](" + "https://civfix.org/".padEnd(4000, "a") + ")",
    ]
    for (const payload of payloads) {
      const nodes = parseMarkdownSubset(payload)
      const json = JSON.stringify(nodes)
      expect(json).not.toContain('"href":"javascript')
      expect(json).not.toContain('"href":"data')
      for (const node of nodes) {
        expect(node.type === "paragraph" || node.type === "list").toBe(true)
      }
    }
  })

  it("parses a pathological input in linear time", () => {
    const started = Date.now()
    parseMarkdownSubset("*".repeat(5000))
    parseMarkdownSubset("[".repeat(5000))
    parseMarkdownSubset("**a".repeat(1600))
    expect(Date.now() - started).toBeLessThan(1000)
  })
})

describe("isSafeMarkdownHref", () => {
  it("accepts only well-formed https URLs", () => {
    expect(isSafeMarkdownHref("https://civfix.org")).toBe(true)
    expect(isSafeMarkdownHref("https://sub.civfix.org:8443/a?b=c#d")).toBe(true)
    expect(isSafeMarkdownHref("HTTPS://CIVFIX.ORG/x")).toBe(true)
    expect(isSafeMarkdownHref("https://civfix..org")).toBe(false)
    expect(isSafeMarkdownHref("https://.civfix.org")).toBe(false)
    expect(isSafeMarkdownHref("https://civ fix.org")).toBe(false)
    expect(isSafeMarkdownHref("")).toBe(false)
  })

  it("rejects every scheme but https", () => {
    expect(isSafeMarkdownHref("javascript:alert(1)")).toBe(false)
    expect(isSafeMarkdownHref("data:text/html;base64,PHNjcmlwdD4=")).toBe(false)
    expect(isSafeMarkdownHref("vbscript:msgbox(1)")).toBe(false)
    expect(isSafeMarkdownHref("http://civfix.org")).toBe(false)
    expect(isSafeMarkdownHref("//evil.example/x")).toBe(false)
    expect(isSafeMarkdownHref("https:/civfix.org")).toBe(false)
  })

  it("rejects userinfo, IP literals and punycode hosts, exactly as the broadcast gate does", () => {
    expect(isSafeMarkdownHref("https://civfix.org@evil.example/x")).toBe(false)
    expect(isSafeMarkdownHref("https://1.2.3.4/x")).toBe(false)
    expect(isSafeMarkdownHref("https://192.168.0.1/x")).toBe(false)
    expect(isSafeMarkdownHref("https://[::1]/x")).toBe(false)
    expect(isSafeMarkdownHref("https://xn--80ak6aa92e.com/x")).toBe(false)
    expect(isSafeMarkdownHref("https://sub.xn--80ak6aa92e.com/x")).toBe(false)
    expect(isSafeMarkdownHref("https://аpple.com/x")).toBe(false)
  })

  it("bounds the href length", () => {
    expect(isSafeMarkdownHref(`https://civfix.org/${"a".repeat(MARKDOWN_MAX_HREF_CHARS)}`)).toBe(
      false,
    )
  })
})

describe("isSafeHttpsUrl", () => {
  it("is the one predicate every link gate in this package shares", () => {
    expect(isSafeHttpsUrl("https://civfix.org/donate")).toBe(true)
    expect(isSafeHttpsUrl("  https://civfix.org/donate  ")).toBe(true)
    expect(isSafeHttpsUrl("https://civfix.org/x", { maxChars: 10 })).toBe(false)
    expect(unsafeHostReason("civfix.org")).toBeNull()
    expect(unsafeHostReason("10.0.0.1")).toBe("ip_literal")
    expect(unsafeHostReason("[::1]")).toBe("ip_literal")
    expect(unsafeHostReason("xn--80ak6aa92e.com")).toBe("punycode")
    expect(unsafeHostReason("аpple.com")).toBe("non_ascii_host")
    expect(unsafeHostReason("civfix..org")).toBe("non_ascii_host")
  })
})

describe("markdownToPlainText", () => {
  it("flattens paragraphs and lists into readable text", () => {
    const nodes = parseMarkdownSubset("Hi **there**\n\n- one\n- [two](https://civfix.org)\n\n1. go")
    expect(markdownToPlainText(nodes)).toBe("Hi there\n\n• one\n• two\n\n1. go")
  })

  it("falls back to the href when a link has no visible text", () => {
    const nodes: MarkdownNode[] = [
      {
        type: "paragraph",
        children: [{ type: "link", href: "https://civfix.org", children: [] }],
      },
    ]
    expect(markdownToPlainText(nodes)).toBe("https://civfix.org")
  })
})
