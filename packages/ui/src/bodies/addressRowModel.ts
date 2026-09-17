import type { AddressPrecision } from "@civfix/shared"
import { needsNearPrefix } from "@civfix/shared"

export interface AddressPoint {
  lat: number
  lng: number
}

export type AddressMapsOption = "apple" | "google" | "copy"

export interface AddressUrlInput {
  address: string | null | undefined
  point: AddressPoint | null | undefined
  verified: boolean
  title?: string | null
}

export interface AddressRowAffordances {
  focusMap: boolean
  copy: boolean
  externalMaps: boolean
  longPressSheet: boolean
}

export type AddressExternalPlan =
  | { kind: "direct"; url: string }
  | { kind: "sheet"; options: readonly AddressMapsOption[] }
  | { kind: "none" }

export function applyNearPrefix(
  address: string,
  precision: AddressPrecision | null | undefined,
  near: (address: string) => string,
): string {
  const line = address.trim()
  if (line.length === 0) return line
  return needsNearPrefix(precision) ? near(line) : line
}

const NEAR_SENTINEL = "__NEAR_ADDRESS__"

export function stripNearPrefix(address: string, near: (address: string) => string): string {
  const value = address.trim()
  if (value.length === 0) return value
  const wrapped = near(NEAR_SENTINEL)
  const at = wrapped.indexOf(NEAR_SENTINEL)
  if (at < 0) return value
  const head = wrapped.slice(0, at)
  const tail = wrapped.slice(at + NEAR_SENTINEL.length)
  if (head.length === 0 && tail.length === 0) return value
  const lower = value.toLowerCase()
  if (head.length > 0 && !lower.startsWith(head.toLowerCase())) return value
  if (tail.length > 0 && !lower.endsWith(tail.toLowerCase())) return value
  const inner = value.slice(head.length, value.length - tail.length).trim()
  return inner.length > 0 ? inner : value
}

function usableAddress(address: string | null | undefined): string | null {
  const line = address?.trim() ?? ""
  return line.length > 0 ? line : null
}

function coordQuery(point: AddressPoint): string {
  return `${point.lat},${point.lng}`
}

export function appleMapsUrl(input: AddressUrlInput): string | null {
  const address = usableAddress(input.address)
  const point = input.point ?? null
  if (input.verified && address) {
    const base = `https://maps.apple.com/?address=${encodeURIComponent(address)}`
    return point ? `${base}&ll=${encodeURIComponent(coordQuery(point))}` : base
  }
  if (!point) return null
  const title = usableAddress(input.title)
  const ll = `https://maps.apple.com/?ll=${encodeURIComponent(coordQuery(point))}`
  return title ? `${ll}&q=${encodeURIComponent(title)}` : ll
}

export function googleMapsUrl(input: AddressUrlInput): string | null {
  const address = usableAddress(input.address)
  const point = input.point ?? null
  if (input.verified && address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  }
  if (!point) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordQuery(point))}`
}

export function geoUri(input: AddressUrlInput): string | null {
  const point = input.point ?? null
  if (!point) return null
  const address = usableAddress(input.address)
  const pin = coordQuery(point)
  if (input.verified && address) return `geo:${pin}?q=${encodeURIComponent(address)}`
  const title = usableAddress(input.title)
  const label = title ? `(${encodeURIComponent(title)})` : ""
  return `geo:${pin}?q=${encodeURIComponent(pin)}${label}`
}

export function addressRowAffordances(input: {
  variant: "full" | "compact"
  hasAddress: boolean
  hasPoint: boolean
  hasFocusTarget: boolean
  hasClipboard: boolean
  hasOpenExternal: boolean
  hasExternalPlan: boolean
}): AddressRowAffordances {
  if (input.variant === "compact") {
    return { focusMap: false, copy: false, externalMaps: false, longPressSheet: false }
  }
  const copy = input.hasAddress && input.hasClipboard
  const externalMaps = input.hasOpenExternal && input.hasExternalPlan
  return {
    focusMap: input.hasPoint && input.hasFocusTarget,
    copy,
    externalMaps,
    longPressSheet: copy || externalMaps,
  }
}

export function addressMapsOptions(input: {
  platform: "ios" | "android" | "web"
  hasApple: boolean
  hasGoogle: boolean
  hasCopy: boolean
}): readonly AddressMapsOption[] {
  const options: AddressMapsOption[] = []
  if (input.platform !== "android" && input.hasApple) options.push("apple")
  if (input.hasGoogle) options.push("google")
  if (input.hasCopy) options.push("copy")
  return options
}

export function addressExternalPlan(input: {
  platform: "ios" | "android" | "web"
  appleUrl: string | null
  googleUrl: string | null
  geoUrl: string | null
  hasCopy: boolean
}): AddressExternalPlan {
  if (input.platform === "web") {
    return input.googleUrl ? { kind: "direct", url: input.googleUrl } : { kind: "none" }
  }
  if (input.platform === "android") {
    if (input.geoUrl) return { kind: "direct", url: input.geoUrl }
    return input.googleUrl ? { kind: "direct", url: input.googleUrl } : { kind: "none" }
  }
  const options = addressMapsOptions({
    platform: "ios",
    hasApple: input.appleUrl !== null,
    hasGoogle: input.googleUrl !== null,
    hasCopy: input.hasCopy,
  })
  if (options.length === 0) return { kind: "none" }
  return { kind: "sheet", options }
}
