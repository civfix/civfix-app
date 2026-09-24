import * as React from "react"
import {
  parseMarkdownSubset,
  type MarkdownInline,
  type MarkdownNode,
} from "@civfix/shared/markdown"

function renderInline(nodes: readonly MarkdownInline[]): React.ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`
    if (node.type === "text") return <React.Fragment key={key}>{node.value}</React.Fragment>
    if (node.type === "strong") return <strong key={key}>{renderInline(node.children)}</strong>
    if (node.type === "em") return <em key={key}>{renderInline(node.children)}</em>
    return (
      <a key={key} href={node.href} rel="noreferrer noopener nofollow" target="_blank">
        {renderInline(node.children)}
      </a>
    )
  })
}

function renderBlock(node: MarkdownNode, index: number): React.ReactNode {
  const key = `${node.type}-${index}`
  if (node.type === "paragraph") return <p key={key}>{renderInline(node.children)}</p>
  const items = node.items.map((item, itemIndex) => (
    <li key={`item-${itemIndex}`}>{renderInline(item.children)}</li>
  ))
  return node.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>
}

export function renderMarkdownNodes(nodes: readonly MarkdownNode[]): React.ReactNode {
  return nodes.map(renderBlock)
}

export function Markdown({ source }: { source: string }) {
  const nodes = React.useMemo(() => parseMarkdownSubset(source), [source])
  return <div className="signup-prose">{renderMarkdownNodes(nodes)}</div>
}
