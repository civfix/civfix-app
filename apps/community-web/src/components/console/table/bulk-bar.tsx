"use client"

import { Fragment, useId } from "react"
import { X } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { KbdHint } from "../chips/badges"

export interface BulkAction {
  id: string
  label: string
  icon?: LucideIcon
  destructive?: boolean
  disabled?: boolean
  disabledReason?: string
  kbd?: string
  onPress: () => void
}

export interface BulkBarProps {
  count: number
  actions: readonly BulkAction[]
  onClear: () => void
  className?: string
}

export function BulkBar({ count, actions, onClear, className }: BulkBarProps) {
  const { t } = useT("host-common")
  const reasonIdBase = useId()
  if (count <= 0) return null
  const selectedLabel = t("table.selected", { count })
  return (
    <div
      role="toolbar"
      aria-label={selectedLabel}
      className={cn(
        "fixed bottom-token-4 left-1/2 z-40 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-token-2 overflow-x-auto rounded-md border border-console-line bg-console-surface px-token-3 py-token-2 shadow-console-3",
        "animate-in fade-in slide-in-from-bottom-4 duration-d2 ease-out",
        className,
      )}
    >
      <span className="shrink-0 whitespace-nowrap text-token-13 font-bold text-console-ink [font-feature-settings:'tnum']">
        {selectedLabel}
      </span>
      <span aria-hidden className="h-5 w-px shrink-0 bg-console-line" />
      {actions.map((action) => {
        const Icon = action.icon
        const reasonId =
          action.disabled && action.disabledReason ? `${reasonIdBase}-${action.id}` : undefined
        return (
          <Fragment key={action.id}>
            <button
              type="button"
              // aria-disabled keeps the action focusable so its disabled reason can be heard.
              aria-disabled={action.disabled || undefined}
              aria-describedby={reasonId}
              title={action.disabled ? action.disabledReason : undefined}
              onClick={() => {
                if (!action.disabled) action.onPress()
              }}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-token-2 text-token-13 font-semibold transition-colors duration-d1 focus-visible:outline-none focus-visible:shadow-console-ring",
                action.destructive
                  ? "text-console-bloom-strong hover:bg-console-bloom-soft"
                  : "text-console-ink-2 hover:bg-console-surface-alt",
                action.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
            >
              {Icon ? <Icon aria-hidden className="h-3.5 w-3.5" /> : null}
              {action.label}
              {action.kbd ? <KbdHint keys={action.kbd} /> : null}
            </button>
            {reasonId ? (
              <span id={reasonId} className="sr-only">
                {action.disabledReason}
              </span>
            ) : null}
          </Fragment>
        )
      })}
      <button
        type="button"
        onClick={onClear}
        aria-label={t("table.clear_selection")}
        className="ml-token-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-console-ink-3 transition-colors duration-d1 hover:bg-console-surface-alt focus-visible:outline-none focus-visible:shadow-console-ring"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  )
}
