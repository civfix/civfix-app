import type { PublicEventPageDTO, PublicPageTicketType, RegisterOutcome } from "@civfix/shared"
import { hasEventEnded, registerOutcomeKey, sortedTicketTypes } from "@civfix/shared/host"

export type WidgetState =
  | "cancelled"
  | "closed"
  | "not_yet_open"
  | "sold_out"
  | "open"

export function registrationWindowState(
  page: PublicEventPageDTO,
  now: number,
): WidgetState {
  if (page.event.status === "cancelled") return "cancelled"
  if (
    hasEventEnded(
      { scheduledAt: page.event.startsAt, endsAt: page.event.endsAt ?? null },
      now,
    )
  ) {
    return "closed"
  }

  const opens = toTime(page.event.registrationOpensAt)
  const closes = toTime(page.event.registrationClosesAt)
  if (opens !== null && now < opens) return "not_yet_open"
  if (closes !== null && now > closes) return "closed"

  const sellable = page.ticketTypes.filter((ticket) => ticket.salesOpen)
  if (page.ticketTypes.length > 0 && sellable.length === 0) return "closed"
  if (sellable.length > 0 && sellable.every((ticket) => ticket.soldOut)) return "sold_out"
  return "open"
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null
  const at = Date.parse(value)
  return Number.isFinite(at) ? at : null
}

export function selectableTickets(page: PublicEventPageDTO): PublicPageTicketType[] {
  return sortedTicketTypes(page.ticketTypes).filter((ticket) => ticket.salesOpen)
}

export function ticketById(
  page: PublicEventPageDTO,
  ticketTypeId: string | null,
): PublicPageTicketType | null {
  if (ticketTypeId === null) return null
  return page.ticketTypes.find((ticket) => ticket.id === ticketTypeId) ?? null
}

export function waitlistAvailable(ticket: PublicPageTicketType | null, page: PublicEventPageDTO): boolean {
  if (ticket !== null) return ticket.waitlistEnabled
  return page.waitlistEnabled
}

/**
 * The i18n key (namespace-qualified) for a register outcome. Refusals reuse the host-ticket
 * `outcome.*` copy the in-app registration shows; the two success shapes have no refusal key, so the
 * signup page owns them.
 */
export function outcomeMessageKey(outcome: RegisterOutcome): string {
  if (outcome === "waitlisted") return "web-signup:outcome.waitlisted"
  const refusal = registerOutcomeKey(outcome)
  return refusal === null ? "web-signup:outcome.registered" : `host-ticket:${refusal}`
}

export function isSuccessOutcome(outcome: RegisterOutcome): boolean {
  return outcome === "registered" || outcome === "replayed" || outcome === "already_registered"
}
