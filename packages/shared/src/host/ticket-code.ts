import { TICKET_TOKEN_MAX, TICKET_TOKEN_MIN } from "../schemas/host/ticket-token.js"

const TICKET_CODE_GROUP = 4

const TICKET_CODE_GROUPING = new RegExp(`(.{${TICKET_CODE_GROUP}})(?=.)`, "g")

// Mirrors the server's normalizer, so a printed, grouped or lower-cased code scans as the raw token.
export function normalizeTicketCode(raw: string): string {
  return raw.replace(/[\s-]+/gu, "").toUpperCase()
}

export function ticketCodeReady(raw: string): boolean {
  const value = normalizeTicketCode(raw)
  return value.length >= TICKET_TOKEN_MIN && value.length <= TICKET_TOKEN_MAX
}

export function formatTicketCode(raw: string): string {
  return normalizeTicketCode(raw).slice(0, TICKET_TOKEN_MAX).replace(TICKET_CODE_GROUPING, "$1-")
}
