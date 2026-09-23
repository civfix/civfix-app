import type {
  EventQuestionDTO,
  PublicEventPageDTO,
  PublicPageTicketType,
  RegisterOutcome,
} from "@civfix/shared"
import { hasEventEnded } from "@civfix/shared/host"

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
  return [...page.ticketTypes]
    .filter((ticket) => ticket.salesOpen)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

export function defaultTicketId(page: PublicEventPageDTO): string | null {
  const available = selectableTickets(page).find((ticket) => !ticket.soldOut)
  return available?.id ?? selectableTickets(page)[0]?.id ?? null
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

export function questionsFor(
  questions: readonly EventQuestionDTO[],
  ticketTypeId: string | null,
): EventQuestionDTO[] {
  return questions
    .filter((question) => question.archivedAt === null || question.archivedAt === undefined)
    .filter(
      (question) =>
        question.ticketTypeId === null ||
        question.ticketTypeId === undefined ||
        question.ticketTypeId === ticketTypeId,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export type AnswerValue = string | boolean | string[]

export function questionVisible(
  question: EventQuestionDTO,
  answers: Readonly<Record<string, AnswerValue>>,
): boolean {
  const condition = question.showIf
  if (!condition) return true
  const value = answers[condition.questionId]
  if (typeof condition.equals === "boolean") return value === condition.equals
  if (Array.isArray(value)) return value.includes(condition.equals)
  return value === condition.equals
}

export function answerIsBlank(value: AnswerValue | undefined): boolean {
  if (value === undefined) return true
  if (typeof value === "string") return value.trim().length === 0
  if (typeof value === "boolean") return value === false
  return value.length === 0
}

export function missingRequired(
  questions: readonly EventQuestionDTO[],
  answers: Readonly<Record<string, AnswerValue>>,
  ticketTypeId: string | null,
): string[] {
  return questionsFor(questions, ticketTypeId)
    .filter((question) => question.required)
    .filter((question) => questionVisible(question, answers))
    .filter((question) => answerIsBlank(answers[question.id]))
    .map((question) => question.id)
}

export function answerPayload(
  questions: readonly EventQuestionDTO[],
  answers: Readonly<Record<string, AnswerValue>>,
  ticketTypeId: string | null,
): Array<{ questionId: string; value: AnswerValue }> {
  return questionsFor(questions, ticketTypeId)
    .filter((question) => questionVisible(question, answers))
    .filter((question) => !answerIsBlank(answers[question.id]))
    .map((question) => ({ questionId: question.id, value: answers[question.id] as AnswerValue }))
}

export function clampPartySize(value: number, max: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(Math.max(1, Math.floor(value)), Math.max(1, max))
}

/**
 * The i18n key (namespace-qualified) for a register outcome. Refusals reuse the host-ticket
 * `outcome.*` copy the in-app registration shows; the two success shapes have no refusal key, so the
 * signup page owns them.
 */
export function outcomeMessageKey(outcome: RegisterOutcome): string {
  switch (outcome) {
    case "registered":
    case "replayed":
      return "web-signup:outcome.registered"
    case "waitlisted":
      return "web-signup:outcome.waitlisted"
    case "already_registered":
      return "host-ticket:outcome.already_registered"
    case "full":
      return "host-ticket:outcome.full"
    case "party_too_large":
      return "host-ticket:outcome.party_too_large"
    case "sales_closed":
      return "host-ticket:outcome.sales_closed"
    case "registration_closed":
      return "host-ticket:outcome.registration_closed"
    case "ticket_type_not_found":
      return "host-ticket:outcome.ticket_type_not_found"
    case "access_code_required":
      return "host-ticket:outcome.access_code_required"
    case "access_code_invalid":
      return "host-ticket:outcome.access_code_invalid"
    case "answers_invalid":
      return "host-ticket:outcome.answers_invalid"
    case "banned":
      return "host-ticket:outcome.banned"
    case "closed":
      return "host-ticket:outcome.closed"
    case "not_found":
      return "host-ticket:outcome.not_found"
  }
}

export function isSuccessOutcome(outcome: RegisterOutcome): boolean {
  return outcome === "registered" || outcome === "replayed" || outcome === "already_registered"
}
