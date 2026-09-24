import type { EventAddressSource } from "@civfix/shared"
import { isVerifiedEventAddress } from "@civfix/shared"
import { safeDateFormat } from "@civfix/shared/datetime"
import type { AddressPoint } from "../addressRowModel"

interface TicketWhen {
  startsAt: string
  endsAt?: string | null | undefined
  timezone?: string | null | undefined
}

const TICKET_DAY_OPTIONS: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }
const TICKET_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
}

export function ticketWhen(ticket: TicketWhen, locale?: string): string {
  const day = safeDateFormat(ticket.startsAt, locale, TICKET_DAY_OPTIONS, ticket.timezone)
  if (day === "") return ""
  return `${day} · ${safeDateFormat(ticket.startsAt, locale, TICKET_TIME_OPTIONS, ticket.timezone)}`
}

function ticketWhere(ticket: { address?: string | null | undefined }): string | null {
  const value = ticket.address?.trim()
  return value && value.length > 0 ? value : null
}

export interface TicketAddressView {
  address: string | null
  point: AddressPoint | null
  verified: boolean
}

export interface TicketAddressEvent {
  lat?: number | null | undefined
  lng?: number | null | undefined
  address?: string | null | undefined
  addressSource?: EventAddressSource | null | undefined
}

export function ticketAddressView(
  ticket: { address?: string | null | undefined },
  event: TicketAddressEvent | null | undefined,
): TicketAddressView {
  const address = ticketWhere(ticket) ?? (event ? ticketWhere(event) : null)
  if (!event) return { address, point: null, verified: false }
  const point =
    event.lat != null && event.lng != null ? { lat: event.lat, lng: event.lng } : null
  return { address, point, verified: isVerifiedEventAddress(event.addressSource, address) }
}

const QR_MAX = 260
const QR_MIN = 160
const QR_PAGE_INSET = 96

export function ticketPageWidth(measured: number): number {
  return Number.isFinite(measured) && measured > 0 ? Math.floor(measured) : 0
}

export function ticketQrSize(pageWidth: number): number {
  if (pageWidth <= 0) return QR_MIN
  return Math.max(QR_MIN, Math.min(QR_MAX, Math.floor(pageWidth - QR_PAGE_INSET)))
}

export function ticketPageIndex(offsetX: number, pageWidth: number, seatCount: number): number {
  if (pageWidth <= 0 || seatCount <= 0) return 0
  const index = Math.round(offsetX / pageWidth)
  return Math.min(Math.max(index, 0), seatCount - 1)
}

export function ticketSeatIndex(seats: readonly { id: string }[], seatId: string | undefined): number {
  if (!seatId) return 0
  const index = seats.findIndex((seat) => seat.id === seatId)
  return index > 0 ? index : 0
}

export function ticketSeatOffset(index: number, pageWidth: number): number {
  return index <= 0 || pageWidth <= 0 ? 0 : index * pageWidth
}
