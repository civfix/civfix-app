/**
 * pollDraft (P6 Task 6.6) - the PURE draft model behind PollCreateSheet: question + option rows, with
 * the auto-append / trim / validate rules the sheet's UI needs. Owns no React state itself so it
 * unit-tests without a renderer (package convention: pure-logic vitest); the sheet holds one
 * `PollDraft` in state and routes every edit through these transforms.
 *
 * Rules (mirroring CreatePollRequest's server bounds):
 *   - question: capped at POLL_QUESTION_MAX (300) chars.
 *   - options: start at POLL_MIN_OPTIONS (2) empty rows; typing into the LAST row auto-appends one
 *     trailing empty row (up to POLL_MAX_OPTIONS = 10) so there is always a "next" blank to type into;
 *     a per-row remove is allowed only while more than POLL_MIN_OPTIONS rows exist.
 *   - submit: enabled once the trimmed question is non-empty AND at least POLL_MIN_OPTIONS options are
 *     non-blank; the create input trims the question and drops blank option rows.
 */

/** Server bound: the poll question length cap (CreatePollRequest.question max). */
export const POLL_QUESTION_MAX = 300
/** Server bound: per-option text length cap (CreatePollRequest.options element max). */
export const POLL_OPTION_MAX = 100
/** Server bound: the minimum number of non-blank options a poll needs (also the starting row count). */
export const POLL_MIN_OPTIONS = 2
/** Server bound: the maximum number of options a poll may carry. */
export const POLL_MAX_OPTIONS = 10

/**
 * One option row. Rows are removable, so each carries an id that survives the rows above it being
 * removed: keying or focusing by position would hand a removed row's focus and native input state to
 * its neighbour.
 */
export interface PollOptionRow {
  id: string
  text: string
}

/** The in-progress poll being composed: the raw question + the raw (possibly-blank) option rows. */
export interface PollDraft {
  question: string
  options: PollOptionRow[]
}

/** The trimmed, submit-ready poll input handed to `chat.createPoll`. */
export interface PollCreateInput {
  question: string
  options: string[]
}

let rowCounter = 0

function blankRow(): PollOptionRow {
  rowCounter += 1
  return { id: `poll-opt-${rowCounter}`, text: "" }
}

/** A fresh draft: an empty question and POLL_MIN_OPTIONS blank option rows. */
export function emptyPollDraft(): PollDraft {
  return { question: "", options: Array.from({ length: POLL_MIN_OPTIONS }, blankRow) }
}

/** Set the question, capped at the server length bound. */
export function setQuestion(draft: PollDraft, text: string): PollDraft {
  return { ...draft, question: text.slice(0, POLL_QUESTION_MAX) }
}

/**
 * Set one option row's text (capped), then auto-append a trailing blank row when the LAST row just
 * became non-blank and we are under POLL_MAX_OPTIONS - so there is always an empty "next" row to type
 * into, until the poll is full.
 */
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

/**
 * Remove an option row - allowed only while more than POLL_MIN_OPTIONS rows exist (a poll always keeps
 * at least two). A no-op (returns the same draft) when at the floor or the index is out of range.
 */
export function removeOption(draft: PollDraft, idx: number): PollDraft {
  if (draft.options.length <= POLL_MIN_OPTIONS) return draft
  if (idx < 0 || idx >= draft.options.length) return draft
  return { ...draft, options: draft.options.filter((_, i) => i !== idx) }
}

/** The raw text of every option row, in order. */
export function optionTexts(draft: PollDraft): string[] {
  return draft.options.map((o) => o.text)
}

/** The trimmed, non-blank option rows (the ones that will actually be submitted). */
export function normalizeOptions(options: string[]): string[] {
  return options.map((o) => o.trim()).filter((o) => o.length > 0)
}

/** Whether the draft can be submitted: a non-empty question and at least POLL_MIN_OPTIONS real options. */
export function canCreatePoll(draft: PollDraft): boolean {
  return draft.question.trim().length > 0 && normalizeOptions(optionTexts(draft)).length >= POLL_MIN_OPTIONS
}

/** The submit-ready input: trimmed question + trimmed, blank-dropped options. */
export function toCreateInput(draft: PollDraft): PollCreateInput {
  return { question: draft.question.trim(), options: normalizeOptions(optionTexts(draft)) }
}
