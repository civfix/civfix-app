import type { EventAddressSource, ResolveAddressResponse } from "@civfix/shared"
import { MAX_EVENT_ADDRESS_LENGTH, geocodePointKey, isLocatedPrecision } from "@civfix/shared"
import { applyNearPrefix } from "./addressRowModel"

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
  addressSource: EventAddressSource | null
}): EventAddressStatus {
  if (!input.hasCoords) return "idle"
  if (input.isResolving && input.addressSource === null) return "resolving"
  return input.addressSource === "resolved" || input.addressSource === "edited"
    ? "resolved"
    : input.addressSource === "manual"
      ? "manual"
      : "resolving"
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
  if (current.addressSource === "edited" || current.addressSource === "manual") return null

  const pointKey = geocodePointKey(coords)
  const line = resolution?.address?.trim() ?? ""
  const located = line.length > 0 && isLocatedPrecision(resolution?.precision)

  if (!located) return { address: "", addressSource: "manual", addressPointKey: pointKey }

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

export function composeEventAddress(input: {
  address: string
  addressSource: EventAddressSource | null
  spot: string
}): { address: string; addressSource: EventAddressSource } | null {
  const line = input.address.trim()
  if (line.length === 0) return null
  const spot = input.spot.trim()
  const composed = spot.length > 0 && !line.startsWith(spot) ? `${spot}, ${line}` : line
  const base: EventAddressSource = input.addressSource ?? "manual"
  const source: EventAddressSource = composed !== line && base === "resolved" ? "edited" : base
  return { address: composed.slice(0, MAX_EVENT_ADDRESS_LENGTH), addressSource: source }
}
