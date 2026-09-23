"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * "card" is the md layout without the dashed border, for use inside an already bordered card. The icon
 * is passed as a fully formed element so each call site keeps its exact icon sizing.
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
