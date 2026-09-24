import { isValidHandle, type HandleAvailableResponse } from "@civfix/shared"

// Mirrors UpdateProfileRequestSchema's displayName max. The two fields plus the joining space must fit,
// or the server rejects the save with a VALIDATION error the user cannot act on.
export const DISPLAY_NAME_MAX = 80
export const FIRST_NAME_MAX = 40
export const LAST_NAME_MAX = DISPLAY_NAME_MAX - FIRST_NAME_MAX - 1

export function splitName(displayName: string): { first: string; last: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: "", last: "" }
  return { first: parts[0]!, last: parts.slice(1).join(" ") }
}

export function stripHandlePrefix(text: string): string {
  return text.replace(/^@+/, "")
}

export interface FirstRunAvailability {
  data?: HandleAvailableResponse
  isFetching: boolean
  isError: boolean
}

export interface FirstRunInput {
  first: string
  last: string
  handle: string
  /** The handle the availability result belongs to (the debounced candidate). */
  checkedHandle: string
  availability: FirstRunAvailability
  ageConfirmed: boolean
  termsConfirmed: boolean
  submitting: boolean
}

export interface FirstRunView {
  trimmedHandle: string
  handleValid: boolean
  displayName: string
  previewName: string
  checking: boolean
  available: boolean
  taken: boolean
  checkFailed: boolean
  canSubmit: boolean
}

/**
 * An availability answer only counts for the handle it was asked about: while the debounce has not
 * caught up with the field, the previous handle's "available" must not enable Continue or the save
 * would carry a handle nobody checked.
 */
export function firstRunModel(input: FirstRunInput): FirstRunView {
  const trimmedHandle = input.handle.trim()
  const handleValid = isValidHandle(trimmedHandle)
  const settled = input.checkedHandle === trimmedHandle
  const { data, isFetching, isError } = input.availability
  const available = handleValid && settled && data?.available === true
  const displayName = `${input.first.trim()} ${input.last.trim()}`.trim()
  return {
    trimmedHandle,
    handleValid,
    displayName,
    previewName: trimmedHandle || displayName || "?",
    checking: handleValid && (!settled || isFetching),
    available,
    taken: handleValid && settled && data?.available === false,
    checkFailed: handleValid && settled && !isFetching && isError,
    canSubmit:
      available &&
      displayName.length > 0 &&
      displayName.length <= DISPLAY_NAME_MAX &&
      input.ageConfirmed &&
      input.termsConfirmed &&
      !input.submitting,
  }
}
