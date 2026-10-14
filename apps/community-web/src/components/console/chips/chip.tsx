"use client"

import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import type { ChipKind, ChipValue } from "./chip-kinds"
import { chipEntry, CHIP_HUE_CLASSES, CHIP_HUE_OUTLINE_CLASSES } from "./chip-kinds"

export type ChipSize = "sm" | "md" | "dot"

export interface ChipProps<K extends ChipKind> {
  kind: K
  value: ChipValue<K>
  size?: ChipSize
  reason?: string
  className?: string
}

const HAIRLINE = { borderColor: "color-mix(in srgb, currentColor 25%, transparent)" }

export function Chip<K extends ChipKind>({
  kind,
  value,
  size = "md",
  reason,
  className,
}: ChipProps<K>) {
  const { t } = useT()
  const entry = chipEntry(kind, value)
  const Icon = entry.icon
  const base = entry.labelKey === "" ? String(value) : t(entry.labelKey)
  const label = reason ? `${base}: ${reason}` : base
  const hueClasses = entry.outline
    ? CHIP_HUE_OUTLINE_CLASSES[entry.hue]
    : CHIP_HUE_CLASSES[entry.hue]

  if (size === "dot") {
    return (
      <span
        className={cn(
          "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-pill border",
          hueClasses,
          className,
        )}
        style={HAIRLINE}
        title={label}
      >
        <Icon aria-hidden className="h-3 w-3" />
        <span className="sr-only">{label}</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border font-semibold",
        size === "sm" ? "h-token-5 px-token-2 text-token-12" : "h-[22px] px-[10px] text-token-12",
        entry.bold && "font-bold",
        hueClasses,
        className,
      )}
      style={HAIRLINE}
      title={label}
    >
      <Icon aria-hidden className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  )
}
