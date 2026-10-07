"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const PANEL_CLASSES =
  "text-center rounded-lg border border-dashed border-ink-5 bg-paper2/50 px-6 py-12"
const ICON_BUBBLE_CLASSES =
  "mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-pill bg-paper2 text-ink-3"
const TITLE_CLASSES = "font-display font-bold text-ink text-token-20"
const BODY_CLASSES = "mx-auto max-w-sm text-ink-3 mt-1.5 text-token-14"

interface EmptyStateProps {
  /** A fully formed Lucide icon element, so each call site keeps its exact icon sizing. */
  icon?: React.ReactNode
  iconTone?: "neutral"
  title?: string
  /**
   * Heading level for the title. When the empty state IS the page (a claim or cancel link that
   * failed), pass "h1" so the document is not left without a top-level heading.
   */
  titleAs?: "h1" | "h2" | "h3" | "h4"
  body?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  titleAs: TitleTag = "h2",
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(PANEL_CLASSES, className)}>
      {icon && <span className={ICON_BUBBLE_CLASSES}>{icon}</span>}
      {title && <TitleTag className={TITLE_CLASSES}>{title}</TitleTag>}
      {body && <p className={BODY_CLASSES}>{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
