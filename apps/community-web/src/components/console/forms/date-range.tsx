"use client"

import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { SegmentedControl } from "./segmented-control"
import { TextInput } from "./inputs"

export type DateRangePreset = "7d" | "30d" | "90d" | "all" | "custom"

export interface DateRangeValue {
  preset: DateRangePreset
  from?: string
  to?: string
}

export const DATE_RANGE_PRESETS: readonly {
  value: DateRangePreset
  labelKey: string
}[] = [
  { value: "7d", labelKey: "form.range_7d" },
  { value: "30d", labelKey: "form.range_30d" },
  { value: "90d", labelKey: "form.range_90d" },
  { value: "all", labelKey: "form.range_all" },
  { value: "custom", labelKey: "form.range_custom" },
]

export const DEFAULT_DATE_RANGE: DateRangeValue = { preset: "30d" }

export function serializeDateRange(value: DateRangeValue): string {
  if (value.preset !== "custom") return value.preset
  return `custom:${value.from ?? ""}:${value.to ?? ""}`
}

export function parseDateRange(raw: string | undefined): DateRangeValue {
  if (!raw) return DEFAULT_DATE_RANGE
  if (raw.startsWith("custom:")) {
    const [, from, to] = raw.split(":")
    return {
      preset: "custom",
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }
  }
  const known = DATE_RANGE_PRESETS.find((preset) => preset.value === raw)
  return known ? { preset: known.value } : DEFAULT_DATE_RANGE
}

export interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  label?: string
  className?: string
}

export function DateRangePicker({ value, onChange, label, className }: DateRangePickerProps) {
  const { t } = useT("host-common")
  return (
    <div className={cn("flex flex-col gap-token-2", className)}>
      <SegmentedControl
        label={label}
        size="sm"
        className="flex-wrap"
        options={DATE_RANGE_PRESETS.map((preset) => ({
          value: preset.value,
          label: t(preset.labelKey),
        }))}
        value={value.preset}
        onChange={(preset) => onChange({ ...value, preset })}
      />
      {value.preset === "custom" ? (
        <div className="flex items-center gap-token-2">
          <label className="flex min-w-0 flex-1 flex-col gap-token-1">
            <span className="text-token-12 font-semibold text-console-ink-3">
              {t("form.range_from")}
            </span>
            <TextInput
              type="date"
              value={value.from ?? ""}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-token-1">
            <span className="text-token-12 font-semibold text-console-ink-3">
              {t("form.range_to")}
            </span>
            <TextInput
              type="date"
              value={value.to ?? ""}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}

export function useDateRangeSummary(): (value: DateRangeValue) => string {
  const { t } = useT("host-common")
  return (value: DateRangeValue) => {
    if (value.preset === "custom") {
      if (value.from || value.to) return `${value.from ?? "…"} – ${value.to ?? "…"}`
      return t("form.range_custom")
    }
    const preset = DATE_RANGE_PRESETS.find((entry) => entry.value === value.preset)
    return preset ? t(preset.labelKey) : value.preset
  }
}
