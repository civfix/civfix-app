"use client"

import { Fragment, useId } from "react"

import { cn } from "@/lib/utils"

import { CountBadge } from "../chips/badges"

export interface SavedTab {
  id: string
  label: string
  count?: number
  hot?: boolean
  disabled?: boolean
  disabledReason?: string
}

export interface SavedTabsProps {
  tabs: readonly SavedTab[]
  activeId: string
  onChange: (id: string) => void
  label: string
  className?: string
}

export function SavedTabs({ tabs, activeId, onChange, label, className }: SavedTabsProps) {
  const reasonIdBase = useId()
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("no-scrollbar flex items-center gap-token-1 overflow-x-auto", className)}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId
        const reasonId =
          tab.disabled && tab.disabledReason ? `${reasonIdBase}-${tab.id}` : undefined
        return (
          <Fragment key={tab.id}>
            <button
              type="button"
              aria-pressed={active}
              // aria-disabled keeps the view focusable so its disabled reason can be heard.
              aria-disabled={tab.disabled || undefined}
              aria-describedby={reasonId}
              title={tab.disabled ? tab.disabledReason : undefined}
              onClick={() => {
                if (!tab.disabled) onChange(tab.id)
              }}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-token-1 whitespace-nowrap rounded-pill px-token-3 text-token-13 font-semibold transition-colors duration-d1 ease-out focus-visible:outline-none focus-visible:shadow-console-ring",
                active
                  ? "border border-console-line bg-console-surface text-console-ink shadow-console-1"
                  : "text-console-ink-3 hover:bg-console-surface-alt hover:text-console-ink-2",
                tab.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
            >
              {tab.label}
              {tab.count !== undefined ? <CountBadge count={tab.count} hot={tab.hot} /> : null}
            </button>
            {reasonId ? (
              <span id={reasonId} className="sr-only">
                {tab.disabledReason}
              </span>
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )
}
