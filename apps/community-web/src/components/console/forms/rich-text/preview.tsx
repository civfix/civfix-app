"use client"

import { Fragment } from "react"
import type { ReactNode } from "react"
import { parseMarkdownSubset } from "@civfix/shared/markdown"
import type { MarkdownInline, MarkdownNode } from "@civfix/shared/markdown"

import { cn } from "@/lib/utils"

function renderInline(nodes: readonly MarkdownInline[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`
    switch (node.type) {
      case "text":
        return <Fragment key={key}>{node.value}</Fragment>
      case "strong":
        return (
          <strong key={key} className="font-bold text-console-ink">
            {renderInline(node.children, key)}
          </strong>
        )
      case "em":
        return (
          <em key={key} className="italic">
            {renderInline(node.children, key)}
          </em>
        )
      case "link":
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="rounded-xs text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
          >
            {renderInline(node.children, key)}
          </a>
        )
    }
  })
}

export function renderMarkdownNodes(nodes: readonly MarkdownNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `block-${index}`
    if (node.type === "paragraph") {
      return (
        <p key={key} className="text-token-14 leading-base text-console-ink-2">
          {renderInline(node.children, key)}
        </p>
      )
    }
    const items = node.items.map((item, itemIndex) => (
      <li key={`${key}-${itemIndex}`} className="text-token-14 leading-base text-console-ink-2">
        {renderInline(item.children, `${key}-${itemIndex}`)}
      </li>
    ))
    return node.ordered ? (
      <ol key={key} className="list-decimal pl-token-5">
        {items}
      </ol>
    ) : (
      <ul key={key} className="list-disc pl-token-5">
        {items}
      </ul>
    )
  })
}

export interface MarkdownPreviewProps {
  source: string
  maxChars?: number
  className?: string
}

export function MarkdownPreview({ source, maxChars, className }: MarkdownPreviewProps) {
  const nodes = parseMarkdownSubset(source, maxChars === undefined ? undefined : { maxChars })
  return (
    <div className={cn("flex flex-col gap-token-2", className)}>{renderMarkdownNodes(nodes)}</div>
  )
}
