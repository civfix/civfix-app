import type { EventAddressSource } from "@civfix/shared"
import { isVerifiedEventAddress } from "@civfix/shared"
import type { AddressPoint } from "../addressRowModel"

interface TicketWhen {
  startsAt: string
  endsAt?: string | null | undefined
  timezone?: string | null | undefined
}

export function ticketWhen(ticket: TicketWhen, locale?: string): string {
  const start = new Date(ticket.startsAt)
  if (Number.isNaN(start.getTime())) return ""
  const zone = ticket.timezone ?? undefined
  const format = (options: Intl.DateTimeFormatOptions): string => {
    try {
      return new Intl.DateTimeFormat(locale, { ...options, ...(zone ? { timeZone: zone } : {}) }).format(
        start,
      )
    } catch {
      return new Intl.DateTimeFormat(locale, options).format(start)
    }
  }
  const day = format({ weekday: "short", month: "short", day: "numeric" })
  const time = format({ hour: "numeric", minute: "2-digit", timeZoneName: "short" })
  return `${day} · ${time}`
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

const TICKET_CODE_GROUP = 4

export function formatTicketCode(token: string): string {
  const value = token.trim().toUpperCase()
  if (value.length === 0) return ""
  const groups: string[] = []
  for (let i = 0; i < value.length; i += TICKET_CODE_GROUP) {
    groups.push(value.slice(i, i + TICKET_CODE_GROUP))
  }
  return groups.join("-")
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
