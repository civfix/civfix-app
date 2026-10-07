import type {
  MarkdownInline,
  MarkdownList,
  MarkdownListItem,
  MarkdownNode,
  MarkdownParagraph,
} from "./ast.js"
import { MARKDOWN_MAX_HREF_CHARS, isSafeMarkdownHref } from "./safe-url.js"
import { intOr } from "../internal/numbers.js"

export const MARKDOWN_SUBSET_MAX_CHARS = 8000
export const MARKDOWN_MAX_INLINE_DEPTH = 4
export const MARKDOWN_MAX_BLOCKS = 200
export const MARKDOWN_MAX_LIST_ITEMS = 100

export interface ParseMarkdownOptions {
  maxChars?: number
}

const ESCAPABLE = new Set(["\\", "`", "*", "_", "[", "]", "(", ")", "#", "+", "-", ".", "!", ">", "|"])
const UNORDERED_ITEM = /^ {0,3}[-*+][ \t]+(.*)$/
const ORDERED_ITEM = /^ {0,3}\d{1,9}[.)][ \t]+(.*)$/
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARS_GLOBAL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu

function pushText(nodes: MarkdownInline[], value: string): void {
  if (value.length === 0) return
  const last = nodes[nodes.length - 1]
  if (last !== undefined && last.type === "text") {
    last.value += value
    return
  }
  nodes.push({ type: "text", value })
}

function hasContent(nodes: readonly MarkdownInline[]): boolean {
  return nodes.some((node) => (node.type === "text" ? node.value.trim().length > 0 : true))
}

function findHrefEnd(src: string, start: number): number {
  const limit = Math.min(src.length, start + MARKDOWN_MAX_HREF_CHARS)
  let depth = 1
  for (let i = start; i < limit; i++) {
    const ch = src[i]
    if (ch === "(") depth += 1
    else if (ch === ")") {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

interface InlineScan {
  noStrongCloser: boolean
  noStarCloser: boolean
  noUnderscoreCloser: boolean
  noBracketCloser: boolean
}

interface InlineMatch {
  nodes: MarkdownInline[]
  next: number
}

function appendInline(target: MarkdownInline[], nodes: readonly MarkdownInline[]): void {
  for (const node of nodes) {
    if (node.type === "text") pushText(target, node.value)
    else target.push(node)
  }
}

function tryStrong(src: string, i: number, depth: number, scan: InlineScan): InlineMatch | null {
  if (src[i] !== "*" || src[i + 1] !== "*" || scan.noStrongCloser) return null
  const close = src.indexOf("**", i + 2)
  if (close === -1) {
    scan.noStrongCloser = true
    return null
  }
  const children = parseInline(src.slice(i + 2, close), depth + 1)
  if (!hasContent(children)) return null
  return { nodes: [{ type: "strong", children }], next: close + 2 }
}

function tryEmphasis(src: string, i: number, depth: number, scan: InlineScan): InlineMatch | null {
  const ch = src[i]
  if (ch !== "*" && ch !== "_") return null
  if (ch === "*" ? scan.noStarCloser : scan.noUnderscoreCloser) return null
  const close = src.indexOf(ch, i + 1)
  if (close === -1) {
    if (ch === "*") scan.noStarCloser = true
    else scan.noUnderscoreCloser = true
    return null
  }
  const children = parseInline(src.slice(i + 1, close), depth + 1)
  if (!hasContent(children)) return null
  return { nodes: [{ type: "em", children }], next: close + 1 }
}

function tryLink(src: string, i: number, depth: number, scan: InlineScan): InlineMatch | null {
  if (src[i] !== "[" || scan.noBracketCloser) return null
  const labelEnd = src.indexOf("]", i + 1)
  if (labelEnd === -1) {
    scan.noBracketCloser = true
    return null
  }
  if (src[labelEnd + 1] !== "(") return null
  const hrefEnd = findHrefEnd(src, labelEnd + 2)
  if (hrefEnd === -1) return null
  const href = src.slice(labelEnd + 2, hrefEnd)
  const children = parseInline(src.slice(i + 1, labelEnd), depth + 1)
  if (!hasContent(children)) return null
  const nodes: MarkdownInline[] = isSafeMarkdownHref(href) ? [{ type: "link", href: href.trim(), children }] : children
  return { nodes, next: hrefEnd + 1 }
}

function tryDelimited(src: string, i: number, depth: number, scan: InlineScan): InlineMatch | null {
  if (depth >= MARKDOWN_MAX_INLINE_DEPTH) return null
  return tryStrong(src, i, depth, scan) ?? tryEmphasis(src, i, depth, scan) ?? tryLink(src, i, depth, scan)
}

function parseInline(src: string, depth: number): MarkdownInline[] {
  const out: MarkdownInline[] = []
  const scan: InlineScan = {
    noStrongCloser: false,
    noStarCloser: false,
    noUnderscoreCloser: false,
    noBracketCloser: false,
  }
  let buffer = ""
  let i = 0

  while (i < src.length) {
    const ch = src[i] as string

    if (ch === "\\" && i + 1 < src.length && ESCAPABLE.has(src[i + 1] as string)) {
      buffer += src[i + 1] as string
      i += 2
      continue
    }

    const match = tryDelimited(src, i, depth, scan)
    if (match === null) {
      buffer += ch
      i += 1
      continue
    }
    pushText(out, buffer)
    buffer = ""
    appendInline(out, match.nodes)
    i = match.next
  }

  pushText(out, buffer)
  return out
}

function paragraphFrom(lines: readonly string[]): MarkdownParagraph | null {
  const children = parseInline(lines.join(" ").trim(), 0)
  return hasContent(children) ? { type: "paragraph", children } : null
}

function listItemFrom(text: string): MarkdownListItem | null {
  const children = parseInline(text.trim(), 0)
  return hasContent(children) ? { type: "listItem", children } : null
}

function markerFor(line: string): { ordered: boolean; text: string } | null {
  const unordered = UNORDERED_ITEM.exec(line)
  if (unordered) return { ordered: false, text: unordered[1] ?? "" }
  const ordered = ORDERED_ITEM.exec(line)
  if (ordered) return { ordered: true, text: ordered[1] ?? "" }
  return null
}

export function parseMarkdownSubset(src: string, options: ParseMarkdownOptions = {}): MarkdownNode[] {
  if (typeof src !== "string" || src.length === 0) return []
  const limit = intOr(options.maxChars, 1, MARKDOWN_SUBSET_MAX_CHARS)
  const normalized = src.slice(0, limit).replace(/\r\n?/gu, "\n").replace(CONTROL_CHARS_GLOBAL, "")
  const lines = normalized.split("\n")

  const nodes: MarkdownNode[] = []
  let paragraph: string[] = []
  let list: MarkdownList | null = null
  let droppedListItem = false

  const closeParagraph = (): void => {
    if (paragraph.length === 0) return
    const node = paragraphFrom(paragraph)
    paragraph = []
    if (node !== null && nodes.length < MARKDOWN_MAX_BLOCKS) nodes.push(node)
  }

  const closeList = (): void => {
    if (list === null) return
    const node = list
    list = null
    if (node.items.length > 0 && nodes.length < MARKDOWN_MAX_BLOCKS) nodes.push(node)
  }

  for (const line of lines) {
    if (nodes.length >= MARKDOWN_MAX_BLOCKS) break
    if (line.trim().length === 0) {
      closeParagraph()
      closeList()
      continue
    }

    const marker = markerFor(line)
    if (marker !== null) {
      closeParagraph()
      if (list !== null && list.ordered !== marker.ordered) closeList()
      if (list === null) list = { type: "list", ordered: marker.ordered, items: [] }
      const item = listItemFrom(marker.text)
      droppedListItem = list.items.length >= MARKDOWN_MAX_LIST_ITEMS
      if (item !== null && !droppedListItem) list.items.push(item)
      continue
    }

    if (list !== null) {
      // A continuation of an item dropped past the cap belongs to that item, not the last kept one.
      if (droppedListItem) continue
      const last = list.items[list.items.length - 1]
      if (last !== undefined) {
        appendInline(last.children, parseInline(` ${line.trim()}`, 0))
        continue
      }
      closeList()
    }

    paragraph.push(line.trim())
  }

  closeParagraph()
  closeList()
  return nodes
}
