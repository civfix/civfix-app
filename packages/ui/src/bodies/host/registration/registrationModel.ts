import type { CleanupDTO, RegisterOutcome, RegistrationState, TicketTypeDTO } from "@civfix/shared"

export type RegistrationSurface =
  | "hidden"
  | "registered"
  | "waitlisted"
  | "cancelled"
  | "form"
  | "waitlist"
  | "closed"
  | "not_yet_open"

export interface RegistrationSurfaceInput {
  status: CleanupDTO["status"]
  ended: boolean
  ticketTypes: readonly TicketTypeDTO[]
  registrationState: RegistrationState | null | undefined
  myRegistration: CleanupDTO["myRegistration"]
}

export function registrationSurface(input: RegistrationSurfaceInput): RegistrationSurface {
  if (input.ticketTypes.length === 0) return "hidden"
  if (input.status === "cancelled" || input.ended) {
    return input.myRegistration?.status === "registered" ? "registered" : "hidden"
  }

  const mine = input.myRegistration
  if (mine?.status === "registered") {
    return mine.waitlistPosition != null ? "waitlisted" : "registered"
  }

  switch (input.registrationState) {
    case "not_yet_open":
      return "not_yet_open"
    case "closed":
      return "closed"
    case "waitlist":
      return "waitlist"
    case "full":
      return input.ticketTypes.some((type) => type.waitlistEnabled) ? "waitlist" : "closed"
    default:
      return mine?.status === "cancelled" ? "cancelled" : "form"
  }
}

export function selectableTicketTypes(types: readonly TicketTypeDTO[]): TicketTypeDTO[] {
  return [...types].sort((a, b) => a.sortOrder - b.sortOrder)
}

function ticketTypeOpen(type: TicketTypeDTO): boolean {
  return type.salesOpen && !type.soldOut
}

export function defaultTicketTypeId(types: readonly TicketTypeDTO[]): string | null {
  const sorted = selectableTicketTypes(types)
  const open = sorted.find(ticketTypeOpen)
  return (open ?? sorted[0])?.id ?? null
}

export function resolveTicketTypeId(
  types: readonly TicketTypeDTO[],
  pickedId: string | null,
): string | null {
  const picked = types.find((type) => type.id === pickedId)
  if (picked && (ticketTypeOpen(picked) || !types.some(ticketTypeOpen))) return picked.id
  return defaultTicketTypeId(types)
}

export function registerOutcomeKey(outcome: RegisterOutcome): string | null {
  switch (outcome) {
    case "registered":
    case "replayed":
    case "waitlisted":
      return null
    case "already_registered":
      return "outcome.already_registered"
    case "full":
      return "outcome.full"
    case "party_too_large":
      return "outcome.party_too_large"
    case "sales_closed":
      return "outcome.sales_closed"
    case "registration_closed":
      return "outcome.registration_closed"
    case "ticket_type_not_found":
      return "outcome.ticket_type_not_found"
    case "access_code_required":
      return "outcome.access_code_required"
    case "access_code_invalid":
      return "outcome.access_code_invalid"
    case "answers_invalid":
      return "outcome.answers_invalid"
    case "banned":
      return "outcome.banned"
    case "closed":
      return "outcome.closed"
    case "not_found":
      return "outcome.not_found"
  }
}

export function registerErrorKey(code: string | undefined): string {
  if (code === "CONFLICT") return "outcome.closed"
  if (code === "FORBIDDEN") return "outcome.banned"
  if (code === "RATE_LIMITED") return "error.rate_limited"
  if (code === "NOT_FOUND") return "outcome.not_found"
  return "error.generic"
}
