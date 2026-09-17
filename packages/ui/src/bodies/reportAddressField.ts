import type { ResolveAddressResponse } from "@civfix/shared"
import { MAX_REPORT_ADDR_LENGTH, isLocatedPrecision } from "@civfix/shared"
import { applyNearPrefix } from "./addressRowModel"

export function reportAddressPrefill(input: {
  hasPoint: boolean
  resolution: ResolveAddressResponse | null | undefined
  currentAddr: string | null
  addrEdited: boolean
  near: (line: string) => string
}): string | null {
  if (!input.hasPoint) return null
  if (input.addrEdited) return null
  if (input.resolution === undefined) return null

  const line = input.resolution?.address?.trim() ?? ""
  if (line.length === 0 || !isLocatedPrecision(input.resolution?.precision)) return null

  const next = applyNearPrefix(line, input.resolution?.precision ?? null, input.near).slice(
    0,
    MAX_REPORT_ADDR_LENGTH,
  )
  return next === (input.currentAddr ?? "") ? null : next
}
