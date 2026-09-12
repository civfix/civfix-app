export const METER_WARN_AT = 0.9

export type MeterState = "ok" | "warn" | "full"

export interface MeterFill {
  ratio: number
  state: MeterState
}

export function meterFill(
  value: number,
  max: number,
  warnAt: number | null = METER_WARN_AT,
): MeterFill {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return { ratio: 0, state: "ok" }
  }
  const ratio = Math.min(1, Math.max(0, value / max))
  if (warnAt === null) return { ratio, state: "ok" }
  if (ratio >= 1) return { ratio, state: "full" }
  return { ratio, state: ratio >= warnAt ? "warn" : "ok" }
}
