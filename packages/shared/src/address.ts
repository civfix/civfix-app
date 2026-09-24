import {
  AddressPrecisionSchema,
  type AddressPrecision,
  type EventAddressSource,
  type ReportAddressSource,
} from "./schemas/entities.js"
import type { LatLngLike } from "./geo.js"

export const ADDRESS_PRECISION_LADDER: readonly AddressPrecision[] = AddressPrecisionSchema.options

export const GEOCODE_POINT_KEY_DECIMALS = 5

export function isLocatedPrecision(precision: AddressPrecision | null | undefined): boolean {
  return precision === "street" || precision === "intersection" || precision === "landmark"
}

export function needsNearPrefix(precision: AddressPrecision | null | undefined): boolean {
  return precision === "landmark"
}

export function comparePrecision(a: AddressPrecision, b: AddressPrecision): number {
  return ADDRESS_PRECISION_LADDER.indexOf(a) - ADDRESS_PRECISION_LADDER.indexOf(b)
}

export function isVerifiedEventAddress(
  addressSource: EventAddressSource | null | undefined,
  address: string | null | undefined,
): boolean {
  if (!address || address.trim().length === 0) return false
  return addressSource === "resolved" || addressSource === "edited" || addressSource === "manual"
}

export function isVerifiedReportAddress(
  addrSource: ReportAddressSource | null | undefined,
  addrPrecision: AddressPrecision | null | undefined,
  addr: string | null | undefined,
): boolean {
  if (!addr || addr.trim().length === 0) return false
  if (addrSource === "user") return true
  return addrSource === "resolved" && addrPrecision === "street"
}

export function roundGeocodeCoord(n: number): number {
  const factor = 10 ** GEOCODE_POINT_KEY_DECIMALS
  return Math.round(n * factor) / factor
}

export function geocodePointKey(point: LatLngLike): string {
  return `${roundGeocodeCoord(point.lat).toFixed(GEOCODE_POINT_KEY_DECIMALS)},${roundGeocodeCoord(
    point.lng,
  ).toFixed(GEOCODE_POINT_KEY_DECIMALS)}`
}
