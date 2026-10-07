/**
 * The code is a fixed-length array of cells, one per rendered input, where "" is an empty cell. Never
 * collapse it into a gap-stripped string: clearing a middle cell would shift every later digit left and
 * the rendered cells would stop matching what the user typed.
 *
 * Several digits can land on one cell at once: a paste, or a browser autofilling the whole code into the
 * first cell (autoComplete="one-time-code").
 */

export type OtpCells = readonly string[]

export function emptyOtpCells(length: number): string[] {
  return Array.from({ length }, () => "")
}

export function isOtpComplete(cells: OtpCells): boolean {
  return cells.length > 0 && cells.every((cell) => cell !== "")
}

export function otpCode(cells: OtpCells): string | null {
  return isOtpComplete(cells) ? cells.join("") : null
}

export interface OtpInputResult {
  cells: string[]
  focusIndex: number
  complete: boolean
}

export function applyOtpInput(prev: OtpCells, index: number, raw: string): OtpInputResult {
  const length = prev.length
  const digits = raw.replace(/\D/g, "")
  const cells = [...prev]

  if (digits.length === 0) {
    cells[index] = ""
    return { cells, focusIndex: index, complete: isOtpComplete(cells) }
  }

  if (digits.length === 1) {
    cells[index] = digits
    const focusIndex = index < length - 1 ? index + 1 : index
    return { cells, focusIndex, complete: isOtpComplete(cells) }
  }

  let lastWritten = index
  for (let d = 0; d < digits.length && index + d < length; d += 1) {
    const cell = index + d
    cells[cell] = digits[d] as string
    lastWritten = cell
  }

  let focusIndex = lastWritten
  for (let c = lastWritten + 1; c < length; c += 1) {
    if (cells[c] === "") {
      focusIndex = c
      break
    }
    focusIndex = c
  }

  return { cells, focusIndex, complete: isOtpComplete(cells) }
}
