"use client"

import { parseMarkdownSubset } from "@civfix/shared/markdown"

import { renderMarkdownNodes, type MarkdownClasses } from "@/components/markdown/markdown-dom"
import { cn } from "@/lib/utils"

const CONSOLE_BODY_TEXT = "text-token-14 leading-base text-console-ink-2"

const CONSOLE_MARKDOWN_CLASSES: MarkdownClasses = {
  paragraph: CONSOLE_BODY_TEXT,
  listItem: CONSOLE_BODY_TEXT,
  orderedList: "list-decimal pl-token-5",
  unorderedList: "list-disc pl-token-5",
  strong: "font-bold text-console-ink",
  em: "italic",
  link: "rounded-xs text-console-sky-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring",
}

export interface MarkdownPreviewProps {
  source: string
  maxChars?: number
  className?: string
}

export function MarkdownPreview({ source, maxChars, className }: MarkdownPreviewProps) {
  const nodes = parseMarkdownSubset(source, maxChars === undefined ? undefined : { maxChars })
  return (
    <div className={cn("flex flex-col gap-token-2", className)}>
      {renderMarkdownNodes(nodes, CONSOLE_MARKDOWN_CLASSES)}
    </div>
  )
}
