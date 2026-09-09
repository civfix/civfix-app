import { TICKET_TOKEN_MAX, TICKET_TOKEN_MIN } from "@civfix/shared"

export function normalizeTicketCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase()
}

export function formatTicketCode(raw: string): string {
  const normalized = normalizeTicketCode(raw).slice(0, TICKET_TOKEN_MAX)
  return normalized.replace(/(.{4})(?=.)/g, "$1-")
}

export function ticketCodeReady(normalized: string): boolean {
  return normalized.length >= TICKET_TOKEN_MIN && normalized.length <= TICKET_TOKEN_MAX
}
