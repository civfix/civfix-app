import type { EventAddressSource, ResolveAddressResponse } from "@civfix/shared"
import { MAX_EVENT_ADDRESS_LENGTH, geocodePointKey, isLocatedPrecision } from "@civfix/shared"
import { applyNearPrefix, stripNearPrefix } from "./addressRowModel"

export const MIN_EVENT_ADDRESS_LENGTH = 3

export type EventAddressStatus = "idle" | "resolving" | "resolved" | "manual"

export interface EventAddressValue {
  address: string
  addressSource: EventAddressSource | null
  addressPointKey: string | null
}

export function eventAddressStatus(input: {
  hasCoords: boolean
  isResolving: boolean
  resolveFailed?: boolean
  addressSource: EventAddressSource | null
}): EventAddressStatus {
  if (!input.hasCoords) return "idle"
  if (input.isResolving && input.addressSource === null) return "resolving"
  if (input.addressSource === "resolved" || input.addressSource === "edited") return "resolved"
  if (input.addressSource === "manual") return "manual"
  return input.resolveFailed === true ? "manual" : "resolving"
}

export function eventAddressPrefill(input: {
  coords: { lat: number; lng: number } | null
  resolution: ResolveAddressResponse | null | undefined
  current: EventAddressValue
  near: (line: string) => string
}): EventAddressValue | null {
  const { coords, resolution, current } = input
  if (!coords) return null
  if (resolution === undefined) return null

  const pointKey = geocodePointKey(coords)
  const hasAddress = current.address.trim().length > 0
  const hostOwned =
    hasAddress && (current.addressSource === "edited" || current.addressSource === "manual")
  if (hostOwned) return null

  const pinMoved = current.addressPointKey !== null && current.addressPointKey !== pointKey
  if (hasAddress && !pinMoved) {
    return current.addressPointKey === null ? { ...current, addressPointKey: pointKey } : null
  }

  const line = resolution?.address?.trim() ?? ""
  const located = line.length > 0 && isLocatedPrecision(resolution?.precision)

  if (!located) {
    if (!hasAddress && current.addressSource === "manual" && current.addressPointKey === pointKey) {
      return null
    }
    return { address: "", addressSource: "manual", addressPointKey: pointKey }
  }

  const next = applyNearPrefix(line, resolution?.precision ?? null, input.near).slice(
    0,
    MAX_EVENT_ADDRESS_LENGTH,
  )
  if (current.address === next && current.addressPointKey === pointKey) return null
  return { address: next, addressSource: "resolved", addressPointKey: pointKey }
}

export function eventAddressEdit(input: {
  text: string
  coords: { lat: number; lng: number } | null
  current: EventAddressValue
}): EventAddressValue {
  const address = input.text.slice(0, MAX_EVENT_ADDRESS_LENGTH)
  const addressSource: EventAddressSource =
    input.current.addressSource === "manual" || input.current.addressSource === null
      ? "manual"
      : "edited"
  return {
    address,
    addressSource,
    addressPointKey: input.coords ? geocodePointKey(input.coords) : input.current.addressPointKey,
  }
}

export function eventAddressPinMoved(input: {
  coords: { lat: number; lng: number } | null
  current: EventAddressValue
}): boolean {
  if (!input.coords || !input.current.addressPointKey) return false
  if (input.current.addressSource !== "edited" && input.current.addressSource !== "manual") {
    return false
  }
  return geocodePointKey(input.coords) !== input.current.addressPointKey
}

export function isEventAddressComplete(address: string): boolean {
  return address.trim().length >= MIN_EVENT_ADDRESS_LENGTH
}

function leadsWithComponent(line: string, spot: string): boolean {
  const haystack = line.toLowerCase()
  const needle = spot.toLowerCase()
  if (!haystack.startsWith(needle)) return false
  const rest = haystack.slice(needle.length).trimStart()
  return rest.length === 0 || rest.startsWith(",")
}

export function composeEventAddress(input: {
  address: string
  addressSource: EventAddressSource | null
  spot: string
  near: (line: string) => string
}): { address: string; addressSource: EventAddressSource } | null {
  const line = input.address.trim()
  if (line.length === 0) return null
  const spot = input.spot.trim()
  const alreadyLeads = spot.length > 0 && leadsWithComponent(stripNearPrefix(line, input.near), spot)
  const composed = spot.length > 0 && !alreadyLeads ? `${spot}, ${line}` : line
  const base: EventAddressSource = input.addressSource ?? "manual"
  const source: EventAddressSource = composed !== line && base === "resolved" ? "edited" : base
  return { address: composed.slice(0, MAX_EVENT_ADDRESS_LENGTH), addressSource: source }
}
