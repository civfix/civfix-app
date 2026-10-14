import type { CleanupDTO, ErrorCodeTable, RegistrationState, TicketTypeDTO } from "@civfix/shared"
import { ErrorCode, byErrorCode } from "@civfix/shared"
import { defaultTicketTypeId, ticketTypeSelectable } from "@civfix/shared/host"

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

export function resolveTicketTypeId(
  types: readonly TicketTypeDTO[],
  pickedId: string | null,
): string | null {
  const picked = types.find((type) => type.id === pickedId)
  if (picked && (ticketTypeSelectable(picked) || !types.some(ticketTypeSelectable))) return picked.id
  return defaultTicketTypeId(types)
}

const REGISTER_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.CONFLICT]: "outcome.closed",
  [ErrorCode.FORBIDDEN]: "outcome.banned",
  [ErrorCode.RATE_LIMITED]: "error.rate_limited",
  [ErrorCode.NOT_FOUND]: "outcome.not_found",
}

export function registerErrorKey(code: string | undefined): string {
  return byErrorCode(code, REGISTER_ERROR_KEYS, "error.generic")
}
