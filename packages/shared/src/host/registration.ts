import type { TicketTypeDTO } from "../schemas/entities.js"
import type { EventAnswerInput, EventAnswerValue, EventQuestionDTO } from "../schemas/host/questions.js"
import type { RegisterOutcome } from "../schemas/host/registrations.js"

export type AnswerMap = Readonly<Record<string, EventAnswerValue>>

type RegistrationQuestion = Pick<
  EventQuestionDTO,
  "id" | "archivedAt" | "ticketTypeId" | "sortOrder" | "showIf" | "required"
>

type SellableTicketType = Pick<TicketTypeDTO, "id" | "sortOrder" | "salesOpen" | "soldOut">

// A gate outside the shown set (another ticket type's question, an archived one) can still hold a stale
// answer, so its dependents stay hidden rather than asking or submitting on the strength of it.
export function questionVisible(
  question: Pick<EventQuestionDTO, "showIf">,
  answers: AnswerMap,
  known: ReadonlySet<string>,
): boolean {
  const condition = question.showIf
  if (!condition) return true
  if (!known.has(condition.questionId)) return false
  const current = answers[condition.questionId]
  if (typeof condition.equals === "boolean") return current === condition.equals
  if (typeof current === "string") return current === condition.equals
  if (Array.isArray(current)) return current.includes(condition.equals)
  return false
}

export function visibleQuestions<Q extends RegistrationQuestion>(
  questions: readonly Q[],
  ticketTypeId: string | null,
  answers: AnswerMap,
): Q[] {
  const scoped = questions
    .filter((question) => question.archivedAt == null)
    .filter((question) => question.ticketTypeId == null || question.ticketTypeId === ticketTypeId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const known = new Set(scoped.map((question) => question.id))
  return scoped.filter((question) => questionVisible(question, answers, known))
}

export function answerIsBlank(value: EventAnswerValue | undefined): boolean {
  if (value === undefined) return true
  if (typeof value === "string") return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return value !== true
}

export function missingRequired(
  shown: readonly Pick<EventQuestionDTO, "id" | "required">[],
  answers: AnswerMap,
): string[] {
  return shown
    .filter((question) => question.required && answerIsBlank(answers[question.id]))
    .map((question) => question.id)
}

export function answerPayload(
  shown: readonly Pick<EventQuestionDTO, "id">[],
  answers: AnswerMap,
): EventAnswerInput[] {
  const out: EventAnswerInput[] = []
  for (const question of shown) {
    const value = answers[question.id]
    if (value === undefined || answerIsBlank(value)) continue
    out.push({ questionId: question.id, value })
  }
  return out
}

export function clampPartySize(value: number, max: number): number {
  const ceiling = Math.max(1, Math.floor(max))
  if (!Number.isFinite(value)) return 1
  return Math.min(ceiling, Math.max(1, Math.floor(value)))
}

export function sortedTicketTypes<T extends Pick<TicketTypeDTO, "sortOrder">>(types: readonly T[]): T[] {
  return [...types].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function ticketTypeSelectable(type: Pick<TicketTypeDTO, "salesOpen" | "soldOut">): boolean {
  return type.salesOpen && !type.soldOut
}

export function defaultTicketTypeId(types: readonly SellableTicketType[]): string | null {
  const sorted = sortedTicketTypes(types)
  const open = sorted.find(ticketTypeSelectable)
  return (open ?? sorted[0])?.id ?? null
}

/** The `host-ticket` key for a refusal; null for the outcomes each surface words itself. */
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
