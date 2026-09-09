"use client"

import { Check, ChevronDown, RotateCcw, X } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { Overlay } from "../overlay/overlay"
import { DateRangePicker, useDateRangeSummary } from "../forms/date-range"
import type { DateRangeValue } from "../forms/date-range"
import { TextInput } from "../forms/inputs"

export interface FilterOption {
  value: string
  label: string
}

export type FilterFacet =
  | {
      id: string
      label: string
      kind: "multi"
      options: readonly FilterOption[]
      values: readonly string[]
      onChange: (values: string[]) => void
    }
  | {
      id: string
      label: string
      kind: "toggle"
      active: boolean
      onChange: (active: boolean) => void
    }
  | {
      id: string
      label: string
      kind: "search"
      value: string
      onChange: (value: string) => void
      placeholder?: string
    }
  | {
      id: string
      label: string
      kind: "range"
      value: DateRangeValue
      defaultPreset?: DateRangeValue["preset"]
      onChange: (value: DateRangeValue) => void
    }
  | {
      id: string
      label: string
      kind: "custom"
      active?: boolean
      valueLabel?: string
      editor: ReactNode
    }

function facetActive(facet: FilterFacet): boolean {
  switch (facet.kind) {
    case "multi":
      return facet.values.length > 0
    case "toggle":
      return facet.active
    case "search":
      return facet.value.length > 0
    case "range":
      return facet.value.preset !== (facet.defaultPreset ?? "30d")
    case "custom":
      return Boolean(facet.active)
  }
}

interface ActiveFilterChip {
  key: string
  label: string
  onRemove: () => void
}

function activeChipsFor(facet: FilterFacet): ActiveFilterChip[] {
  switch (facet.kind) {
    case "multi":
      return facet.values.map((value) => {
        const option = facet.options.find((o) => o.value === value)
        return {
          key: `${facet.id}:${value}`,
          label: `${facet.label}: ${option?.label ?? value}`,
          onRemove: () => facet.onChange(facet.values.filter((v) => v !== value)),
        }
      })
    case "toggle":
      return facet.active
        ? [{ key: facet.id, label: facet.label, onRemove: () => facet.onChange(false) }]
        : []
    case "search":
      return facet.value.length > 0
        ? [
            {
              key: facet.id,
              label: `${facet.label}: ${facet.value}`,
              onRemove: () => facet.onChange(""),
            },
          ]
        : []
    case "range":
    case "custom":
      return []
  }
}

const CHIP_BUTTON_BASE =
  "inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border px-token-3 text-token-13 font-semibold transition-colors duration-d1 focus-visible:outline-none focus-visible:shadow-console-ring"

const CHIP_ACTIVE = "border-console-ink-2 bg-console-surface text-console-ink shadow-console-1"
const CHIP_IDLE =
  "border-console-line bg-console-surface text-console-ink-3 hover:bg-console-surface-alt hover:text-console-ink-2"

export interface FilterBarProps {
  facets: readonly FilterFacet[]
  onReset?: () => void
  className?: string
}

export function FilterBar({ facets, onReset, className }: FilterBarProps) {
  const { t } = useT("host-common")
  const rangeSummary = useDateRangeSummary()
  const [openId, setOpenId] = useState<string | null>(null)
  const anyActive = facets.some(facetActive)
  const activeChips = facets.flatMap(activeChipsFor)

  const summaryOf = (facet: FilterFacet): string => {
    switch (facet.kind) {
      case "multi": {
        if (facet.values.length === 0) return facet.label
        const first = facet.options.find((o) => o.value === facet.values[0])
        const extra = facet.values.length - 1
        return `${facet.label}: ${first?.label ?? facet.values[0]}${extra > 0 ? ` +${extra}` : ""}`
      }
      case "range":
        return `${facet.label}: ${rangeSummary(facet.value)}`
      case "custom":
        return facet.valueLabel ? `${facet.label}: ${facet.valueLabel}` : facet.label
      default:
        return facet.label
    }
  }

  return (
    <div className={cn("flex flex-col gap-token-2", className)}>
      <div className="flex flex-wrap items-center gap-token-2">
        {facets.map((facet) => {
          if (facet.kind === "search") {
            return (
              <TextInput
                key={facet.id}
                leadingIcon="search"
                type="search"
                value={facet.value}
                onChange={(event) => facet.onChange(event.target.value)}
                placeholder={facet.placeholder ?? t("filter.search_placeholder")}
                aria-label={facet.label}
                className="h-8 w-52 rounded-pill"
              />
            )
          }
          if (facet.kind === "toggle") {
            return (
              <button
                key={facet.id}
                type="button"
                aria-pressed={facet.active}
                onClick={() => facet.onChange(!facet.active)}
                className={cn(CHIP_BUTTON_BASE, facet.active ? CHIP_ACTIVE : CHIP_IDLE)}
              >
                {facet.active ? <Check aria-hidden className="h-3.5 w-3.5" /> : null}
                {facet.label}
              </button>
            )
          }
          const open = openId === facet.id
          return (
            <Overlay
              key={facet.id}
              open={open}
              onClose={() => setOpenId(null)}
              label={facet.label}
              trigger={
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : facet.id)}
                  className={cn(
                    CHIP_BUTTON_BASE,
                    facetActive(facet) ? CHIP_ACTIVE : CHIP_IDLE,
                  )}
                >
                  {summaryOf(facet)}
                  <ChevronDown aria-hidden className="h-3.5 w-3.5" />
                </button>
              }
            >
              {facet.kind === "multi" ? (
                <ul className="flex flex-col">
                  {facet.options.map((option) => {
                    const checked = facet.values.includes(option.value)
                    return (
                      <li key={option.value}>
                        <label className="flex min-h-[36px] cursor-pointer items-center gap-token-2 rounded-xs px-token-2 py-1 text-token-13 text-console-ink-2 hover:bg-console-surface-alt">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              facet.onChange(
                                checked
                                  ? facet.values.filter((v) => v !== option.value)
                                  : [...facet.values, option.value],
                              )
                            }
                            className="h-4 w-4 accent-console-accent"
                          />
                          {option.label}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              ) : facet.kind === "range" ? (
                <DateRangePicker
                  value={facet.value}
                  onChange={facet.onChange}
                  label={facet.label}
                />
              ) : (
                facet.editor
              )}
            </Overlay>
          )
        })}
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            disabled={!anyActive}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-pill px-token-2 text-token-13 font-semibold text-console-ink-3 hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" />
            {t("filter.reset")}
          </button>
        ) : null}
      </div>
      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-token-2">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex h-7 items-center gap-1 rounded-pill border border-console-ink-2 bg-console-surface py-0 pl-token-3 pr-1 text-token-12 font-semibold text-console-ink shadow-console-1"
            >
              {chip.label}
              <button
                type="button"
                aria-label={t("filter.remove_chip", { label: chip.label })}
                onClick={chip.onRemove}
                className="flex h-5 w-5 items-center justify-center rounded-pill text-console-ink-3 hover:bg-console-surface-alt hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring"
              >
                <X aria-hidden className="h-3 w-3" />
              </button>
            </span>
          ))}
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-7 shrink-0 items-center rounded-pill px-token-2 text-token-12 font-semibold text-console-ink-3 hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring"
            >
              {t("filter.clear_all")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
