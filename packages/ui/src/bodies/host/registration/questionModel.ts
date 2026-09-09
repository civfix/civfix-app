import type { EventAnswerInput, EventAnswerValue, EventQuestionDTO } from "@civfix/shared"

export type AnswerMap = Readonly<Record<string, EventAnswerValue>>

export function initialAnswer(question: EventQuestionDTO): EventAnswerValue {
  switch (question.kind) {
    case "multi_select":
      return []
    case "checkbox":
    case "consent":
      return false
    default:
      return ""
  }
}

export function initialAnswers(questions: readonly EventQuestionDTO[]): AnswerMap {
  const out: Record<string, EventAnswerValue> = {}
  for (const question of questions) out[question.id] = initialAnswer(question)
  return out
}

export function seedAnswers(prev: AnswerMap, questions: readonly EventQuestionDTO[]): AnswerMap {
  if (questions.length === 0 || Object.keys(prev).length > 0) return prev
  return initialAnswers(questions)
}

export function questionVisible(
  question: EventQuestionDTO,
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

export function visibleQuestions(
  questions: readonly EventQuestionDTO[],
  ticketTypeId: string | null,
  answers: AnswerMap,
): EventQuestionDTO[] {
  const scoped = questions
    .filter((q) => q.archivedAt == null)
    .filter((q) => q.ticketTypeId == null || q.ticketTypeId === ticketTypeId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const known = new Set(scoped.map((q) => q.id))
  return scoped.filter((q) => questionVisible(q, answers, known))
}

export function answerIsBlank(value: EventAnswerValue | undefined): boolean {
  if (value === undefined) return true
  if (typeof value === "string") return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return value !== true
}

export function missingRequired(
  questions: readonly EventQuestionDTO[],
  answers: AnswerMap,
): string[] {
  return questions.filter((q) => q.required && answerIsBlank(answers[q.id])).map((q) => q.id)
}

export function answerPayload(
  questions: readonly EventQuestionDTO[],
  answers: AnswerMap,
): EventAnswerInput[] {
  const out: EventAnswerInput[] = []
  for (const question of questions) {
    const value = answers[question.id]
    if (value === undefined) continue
    if (answerIsBlank(value) && !question.required) continue
    out.push({ questionId: question.id, value })
  }
  return out
}

export function toggleMultiSelect(current: EventAnswerValue | undefined, option: string): string[] {
  const list = Array.isArray(current) ? current : []
  return list.includes(option) ? list.filter((v) => v !== option) : [...list, option]
}
