import type { MarkdownInline, MarkdownNode } from "./ast.js"

function inlineText(nodes: readonly MarkdownInline[]): string {
  let out = ""
  for (const node of nodes) {
    if (node.type === "text") {
      out += node.value
      continue
    }
    const inner = inlineText(node.children)
    out += node.type === "link" && inner.trim().length === 0 ? node.href : inner
  }
  return out
}

export function markdownInlineToPlainText(nodes: readonly MarkdownInline[]): string {
  return inlineText(nodes).replace(/\s+/gu, " ").trim()
}

export function markdownToPlainText(nodes: readonly MarkdownNode[]): string {
  const blocks: string[] = []
  for (const node of nodes) {
    if (node.type === "paragraph") {
      const text = markdownInlineToPlainText(node.children)
      if (text.length > 0) blocks.push(text)
      continue
    }
    const lines = node.items.map((item, index) => {
      const text = markdownInlineToPlainText(item.children)
      return node.ordered ? `${index + 1}. ${text}` : `• ${text}`
    })
    if (lines.length > 0) blocks.push(lines.join("\n"))
  }
  return blocks.join("\n\n")
}
