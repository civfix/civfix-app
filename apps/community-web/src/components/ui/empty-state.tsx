"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * The shared empty / error / prompt panel used across the app.
 *
 * Two families collapse into one component via the `size` variant:
 *  - "sm"   == the sidebar section placeholder (rounded-md dashed panel, body text only).
 *  - "md"   == the full dashed panel (rounded-lg, px-6 py-12) with an optional tinted icon bubble,
 *              a display-font title, a body line, and an optional CTA. This is the ~px-6 py-12 markup
 *              that was hand-duplicated across cleanups, people, profiles, reports, claim, host, etc.
 *  - "card" == the same md layout WITHOUT the dashed border, for use inside an existing bordered card
 *              (the inbox and notifications empty states sit inside a card already).
 *
 * The icon is passed as a fully-formed element (e.g. `<CalendarX2 className="h-7 w-7" />`) so each
 * call site keeps its exact icon sizing; only the tinted bubble wrapper is standardized here.
 */
const panelVariants = cva("text-center", {
  variants: {
    size: {
      sm: "rounded-md border border-dashed border-ink-5 bg-paper2/60 px-3 py-4",
      md: "rounded-lg border border-dashed border-ink-5 bg-paper2/50 px-6 py-12",
      card: "px-6 py-12",
    },
  },
  defaultVariants: {
    size: "md",
  },
})

const titleVariants = cva("font-display font-bold text-ink", {
  variants: {
    size: {
      sm: "",
      md: "text-token-20",
      card: "text-token-18",
    },
  },
  defaultVariants: {
    size: "md",
  },
})

const bodyVariants = cva("mx-auto max-w-sm text-ink-3", {
  variants: {
    size: {
      sm: "text-token-13",
      md: "mt-1.5 text-token-14",
      card: "mt-1 text-token-13",
    },
  },
  defaultVariants: {
    size: "md",
  },
})

/** Background/foreground tints for the icon bubble (token-driven; no palette hexes). */
const iconToneClasses: Record<NonNullable<EmptyStateProps["iconTone"]>, string> = {
  neutral: "bg-paper2 text-ink-3",
  sun: "bg-sun-100 text-sun-600",
  moss: "bg-moss-100 text-moss-600",
  bloom: "bg-bloom-50 text-primary",
  sky: "bg-sky-100 text-sky-700",
  lilac: "bg-lilac-50 text-lilac-600",
}

export interface EmptyStateProps extends VariantProps<typeof panelVariants> {
  /** Lucide icon element; rendered inside the tinted bubble (md/card only). */
  icon?: React.ReactNode
  iconTone?: "neutral" | "sun" | "moss" | "bloom" | "sky" | "lilac"
  title?: string
  /**
   * Heading level for the title. When the empty state IS the page (a claim or cancel link that
   * failed), pass "h1" so the document is not left without a top-level heading.
   */
  titleAs?: "h1" | "h2" | "h3" | "h4"
  body?: React.ReactNode
  /** A <Button> or link rendered under the body (md/card), or under the text (sm). */
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  iconTone = "neutral",
  title,
  titleAs: TitleTag = "h2",
  body,
  action,
  size = "md",
  className,
}: EmptyStateProps) {
  // The sidebar (sm) variant is body + optional action only, with tighter action spacing.
  if (size === "sm") {
    return (
      <div className={cn(panelVariants({ size }), className)}>
        {body && <p className={bodyVariants({ size })}>{body}</p>}
        {action && <div className="mt-2 flex justify-center">{action}</div>}
      </div>
    )
  }

  return (
    <div className={cn(panelVariants({ size }), className)}>
      {icon && (
        <span
          className={cn(
            "mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-pill",
            iconToneClasses[iconTone],
          )}
        >
          {icon}
        </span>
      )}
      {title && <TitleTag className={titleVariants({ size })}>{title}</TitleTag>}
      {body && <p className={bodyVariants({ size })}>{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
