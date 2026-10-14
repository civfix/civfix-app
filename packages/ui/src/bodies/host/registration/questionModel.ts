import type { EventAnswerValue, EventQuestionDTO } from "@civfix/shared"
import type { AnswerMap } from "@civfix/shared/host"

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

export function toggleMultiSelect(current: EventAnswerValue | undefined, option: string): string[] {
  const list = Array.isArray(current) ? current : []
  return list.includes(option) ? list.filter((v) => v !== option) : [...list, option]
}
