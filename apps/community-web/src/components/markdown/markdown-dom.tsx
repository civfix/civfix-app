import * as React from "react"
import {
  parseMarkdownSubset,
  type MarkdownInline,
  type MarkdownNode,
} from "@civfix/shared/markdown"

// Plain DOM on purpose: the host console renders its preview through this module, and its lint boundary
// forbids anything that reaches React Native.

/** Per-element classes for surfaces that style markup directly instead of through a prose container. */
export interface MarkdownClasses {
  paragraph?: string
  listItem?: string
  orderedList?: string
  unorderedList?: string
  strong?: string
  em?: string
  link?: string
}

const NO_CLASSES: MarkdownClasses = {}

function renderInline(nodes: readonly MarkdownInline[], classes: MarkdownClasses): React.ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`
    if (node.type === "text") return <React.Fragment key={key}>{node.value}</React.Fragment>
    if (node.type === "strong") {
      return (
        <strong key={key} className={classes.strong}>
          {renderInline(node.children, classes)}
        </strong>
      )
    }
    if (node.type === "em") {
      return (
        <em key={key} className={classes.em}>
          {renderInline(node.children, classes)}
        </em>
      )
    }
    return (
      <a key={key} href={node.href} rel="noreferrer noopener nofollow" target="_blank" className={classes.link}>
        {renderInline(node.children, classes)}
      </a>
    )
  })
}

function renderBlock(node: MarkdownNode, index: number, classes: MarkdownClasses): React.ReactNode {
  const key = `${node.type}-${index}`
  if (node.type === "paragraph") {
    return (
      <p key={key} className={classes.paragraph}>
        {renderInline(node.children, classes)}
      </p>
    )
  }
  const items = node.items.map((item, itemIndex) => (
    <li key={`item-${itemIndex}`} className={classes.listItem}>
      {renderInline(item.children, classes)}
    </li>
  ))
  return node.ordered ? (
    <ol key={key} className={classes.orderedList}>
      {items}
    </ol>
  ) : (
    <ul key={key} className={classes.unorderedList}>
      {items}
    </ul>
  )
}

export function renderMarkdownNodes(
  nodes: readonly MarkdownNode[],
  classes: MarkdownClasses = NO_CLASSES,
): React.ReactNode {
  return nodes.map((node, index) => renderBlock(node, index, classes))
}

export function Markdown({ source }: { source: string }) {
  const nodes = React.useMemo(() => parseMarkdownSubset(source), [source])
  return <div className="signup-prose">{renderMarkdownNodes(nodes)}</div>
}
