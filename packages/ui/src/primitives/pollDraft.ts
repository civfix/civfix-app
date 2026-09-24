import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, POLL_OPTION_MAX, POLL_QUESTION_MAX } from "@civfix/shared"

/**
 * Rows carry an id because keying or focusing by position would hand a removed row's focus and native
 * input state to its neighbour.
 */
export interface PollOptionRow {
  id: string
  text: string
}

export interface PollDraft {
  question: string
  options: PollOptionRow[]
}

export interface PollDraftInput {
  question: string
  options: string[]
}

let rowCounter = 0

function blankRow(): PollOptionRow {
  rowCounter += 1
  return { id: `poll-opt-${rowCounter}`, text: "" }
}

export function emptyPollDraft(): PollDraft {
  return { question: "", options: Array.from({ length: POLL_MIN_OPTIONS }, blankRow) }
}

export function setQuestion(draft: PollDraft, text: string): PollDraft {
  return { ...draft, question: text.slice(0, POLL_QUESTION_MAX) }
}

/** Typing into the last row appends a blank one, so there is always a next row until the poll is full. */
export function setOption(draft: PollDraft, idx: number, text: string): PollDraft {
  if (idx < 0 || idx >= draft.options.length) return draft
  const capped = text.slice(0, POLL_OPTION_MAX)
  const options = draft.options.map((o, i) => (i === idx ? { ...o, text: capped } : o))
  const last = options[options.length - 1]?.text ?? ""
  if (last.trim().length > 0 && options.length < POLL_MAX_OPTIONS) {
    options.push(blankRow())
  }
  return { ...draft, options }
}

export function removeOption(draft: PollDraft, idx: number): PollDraft {
  if (draft.options.length <= POLL_MIN_OPTIONS) return draft
  if (idx < 0 || idx >= draft.options.length) return draft
  return { ...draft, options: draft.options.filter((_, i) => i !== idx) }
}

export function optionTexts(draft: PollDraft): string[] {
  return draft.options.map((o) => o.text)
}

export function normalizeOptions(options: string[]): string[] {
  return options.map((o) => o.trim()).filter((o) => o.length > 0)
}

export function canCreatePoll(draft: PollDraft): boolean {
  return draft.question.trim().length > 0 && normalizeOptions(optionTexts(draft)).length >= POLL_MIN_OPTIONS
}

export function toCreateInput(draft: PollDraft): PollDraftInput {
  return { question: draft.question.trim(), options: normalizeOptions(optionTexts(draft)) }
}
