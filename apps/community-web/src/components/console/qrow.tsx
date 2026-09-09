"use client"

import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

export interface QRowProps {
  leading?: ReactNode
  title: ReactNode
  pressLabel?: string
  wrapTitle?: boolean
  clampTitle?: boolean
  ident?: string
  sub?: ReactNode
  chips?: ReactNode
  trailing?: ReactNode
  selected?: boolean
  current?: boolean
  selectable?: boolean
  selectLabel?: string
  onSelectChange?: (selected: boolean) => void
  onPress?: () => void
  density?: "tight" | "cozy"
  as?: "row" | "card"
  leadingAlign?: "center" | "start"
  disabled?: boolean
  className?: string
}

export function QRow({
  leading,
  title,
  pressLabel,
  wrapTitle,
  clampTitle,
  ident,
  sub,
  chips,
  trailing,
  selected,
  current,
  selectable,
  selectLabel,
  onSelectChange,
  onPress,
  density = "tight",
  as = "row",
  leadingAlign = "center",
  disabled,
  className,
}: QRowProps) {
  const { t } = useT("host-common")
  const interactive = Boolean(onPress) && !disabled

  const titleBlock = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span
        className={cn(
          "flex min-w-0 gap-token-2",
          clampTitle ? "flex-col items-start gap-0.5" : "items-baseline",
        )}
      >
        {ident ? (
          <span className="shrink-0 whitespace-nowrap font-mono text-token-12 text-console-ink-3">
            {ident}
          </span>
        ) : null}
        <span
          className={cn(
            "min-w-0 text-token-14 font-semibold text-console-ink",
            wrapTitle ? "break-words" : clampTitle ? "line-clamp-2 break-words" : "truncate",
          )}
        >
          {title}
        </span>
      </span>
      {sub ? (
        <span className="flex min-w-0 items-center truncate text-token-12 text-console-ink-3">
          {sub}
        </span>
      ) : null}
      {chips ? <span className="mt-0.5 flex flex-wrap items-center gap-1">{chips}</span> : null}
    </span>
  )

  return (
    <div
      className={cn(
        "group relative flex w-full min-w-0 items-center gap-token-3 text-left",
        density === "tight" ? "px-token-4 py-[13px]" : "px-token-4 py-token-4",
        as === "card"
          ? "rounded-sm border border-console-line bg-console-surface shadow-console-1"
          : "border-b border-console-line last:border-b-0",
        interactive && "transition-colors duration-d1 ease-out hover:bg-console-surface-alt/60",
        current && "bg-console-surface-alt",
        disabled && "opacity-50",
        className,
      )}
    >
      {selected ? (
        <span
          aria-hidden
          className={cn(
            "absolute bottom-1 left-0 top-1 w-[3px] rounded-pill bg-console-accent",
            as === "card" && "bottom-2 top-2",
          )}
        />
      ) : null}
      {selectable ? (
        <input
          type="checkbox"
          aria-label={selectLabel ?? t("table.select_row")}
          checked={Boolean(selected)}
          disabled={disabled}
          onChange={(event) => onSelectChange?.(event.target.checked)}
          className="h-4 w-4 shrink-0 accent-console-accent"
        />
      ) : null}
      {leading ? (
        <span
          className={cn(
            "flex shrink-0 items-center",
            leadingAlign === "start" && "self-start pt-0.5",
          )}
        >
          {leading}
        </span>
      ) : null}
      {interactive ? (
        <button
          type="button"
          onClick={onPress}
          aria-label={pressLabel}
          aria-current={current ? "true" : undefined}
          className="flex min-w-0 flex-1 items-center gap-token-3 rounded-xs text-left focus-visible:outline-none focus-visible:shadow-console-ring"
        >
          {titleBlock}
          <ChevronRight
            aria-hidden
            className="h-4 w-4 shrink-0 text-console-ink-3 opacity-0 transition-opacity duration-d1 group-hover:opacity-100 group-focus-within:opacity-100"
          />
        </button>
      ) : (
        titleBlock
      )}
      {trailing ? (
        <span className="flex shrink-0 items-center gap-token-2 text-token-12 text-console-ink-3">
          {trailing}
        </span>
      ) : null}
    </div>
  )
}
