"use client"

import { ChevronDown, RotateCcw, X } from "lucide-react"
import { useId, useState } from "react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { Overlay } from "../overlay/overlay"
import { TextInput } from "../forms/inputs"

export interface FilterOption {
  value: string
  label: string
}

type MultiFacet = {
  id: string
  label: string
  kind: "multi"
  options: readonly FilterOption[]
  values: readonly string[]
  onChange: (values: string[]) => void
}

export type FilterFacet =
  | MultiFacet
  | {
      id: string
      label: string
      kind: "search"
      value: string
      onChange: (value: string) => void
      placeholder?: string
    }

function facetActive(facet: FilterFacet): boolean {
  return facet.kind === "multi" ? facet.values.length > 0 : facet.value.length > 0
}

interface ActiveFilterChip {
  key: string
  label: string
  onRemove: () => void
}

function activeChipsFor(facet: FilterFacet): ActiveFilterChip[] {
  if (facet.kind === "multi") {
    return facet.values.map((value) => {
      const option = facet.options.find((o) => o.value === value)
      return {
        key: `${facet.id}:${value}`,
        label: `${facet.label}: ${option?.label ?? value}`,
        onRemove: () => facet.onChange(facet.values.filter((v) => v !== value)),
      }
    })
  }
  if (facet.value.length === 0) return []
  return [
    {
      key: facet.id,
      label: `${facet.label}: ${facet.value}`,
      onRemove: () => facet.onChange(""),
    },
  ]
}

function multiSummary(facet: MultiFacet): string {
  if (facet.values.length === 0) return facet.label
  const first = facet.options.find((o) => o.value === facet.values[0])
  const extra = facet.values.length - 1
  return `${facet.label}: ${first?.label ?? facet.values[0]}${extra > 0 ? ` +${extra}` : ""}`
}

const CHIP_BUTTON_BASE =
  "inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border px-token-3 text-token-13 font-semibold transition-colors duration-d1 focus-visible:outline-none focus-visible:shadow-console-ring"

const CHIP_ACTIVE = "border-console-ink-2 bg-console-surface text-console-ink shadow-console-1"
const CHIP_IDLE =
  "border-console-line bg-console-surface text-console-ink-3 hover:bg-console-surface-alt hover:text-console-ink-2"

function MultiFacetPopover({
  facet,
  open,
  panelId,
  onToggle,
  onClose,
}: {
  facet: MultiFacet
  open: boolean
  panelId: string
  onToggle: () => void
  onClose: () => void
}) {
  return (
    <Overlay
      open={open}
      onClose={onClose}
      label={facet.label}
      id={panelId}
      trigger={
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? panelId : undefined}
          onClick={onToggle}
          className={cn(CHIP_BUTTON_BASE, facetActive(facet) ? CHIP_ACTIVE : CHIP_IDLE)}
        >
          {multiSummary(facet)}
          <ChevronDown aria-hidden className="h-3.5 w-3.5" />
        </button>
      }
    >
      <ul className="flex flex-col">
        {facet.options.map((option) => {
          const checked = facet.values.includes(option.value)
          return (
            <li key={option.value}>
              <label className="flex min-h-9 cursor-pointer items-center gap-token-2 rounded-xs px-token-2 py-1 text-token-13 text-console-ink-2 transition-colors duration-d1 hover:bg-console-surface-alt">
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
    </Overlay>
  )
}

function ActiveChipRow({
  chips,
  onReset,
}: {
  chips: readonly ActiveFilterChip[]
  onReset?: () => void
}) {
  const { t } = useT("host-common")
  return (
    <div className="flex flex-wrap items-center gap-token-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex h-7 items-center gap-1 rounded-pill border border-console-ink-2 bg-console-surface py-0 pl-token-3 pr-1 text-token-12 font-semibold text-console-ink shadow-console-1"
        >
          {chip.label}
          <button
            type="button"
            aria-label={t("filter.remove_chip", { label: chip.label })}
            onClick={chip.onRemove}
            className="flex h-6 w-6 items-center justify-center rounded-pill text-console-ink-3 transition-colors duration-d1 hover:bg-console-surface-alt hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring"
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
  )
}

export interface FilterBarProps {
  facets: readonly FilterFacet[]
  onReset?: () => void
  className?: string
}

export function FilterBar({ facets, onReset, className }: FilterBarProps) {
  const { t } = useT("host-common")
  const [openId, setOpenId] = useState<string | null>(null)
  const panelIdBase = useId()
  const anyActive = facets.some(facetActive)
  const activeChips = facets.flatMap(activeChipsFor)

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
          const open = openId === facet.id
          return (
            <MultiFacetPopover
              key={facet.id}
              facet={facet}
              open={open}
              panelId={`${panelIdBase}-${facet.id}`}
              onToggle={() => setOpenId(open ? null : facet.id)}
              onClose={() => setOpenId(null)}
            />
          )
        })}
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            disabled={!anyActive}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-pill px-token-2 text-token-13 font-semibold text-console-ink-3 transition-colors duration-d1 hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" />
            {t("filter.reset")}
          </button>
        ) : null}
      </div>
      {activeChips.length > 0 ? <ActiveChipRow chips={activeChips} onReset={onReset} /> : null}
    </div>
  )
}
