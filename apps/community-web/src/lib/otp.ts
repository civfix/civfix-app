/**
 * Pure helpers behind the email one-time-code (OTP) entry in the auth modal. They live apart from the
 * React component so the completion + digit-distribution logic can be unit tested without a DOM.
 *
 * The code is a fixed-length array of cells, one per rendered input, where "" is an empty cell. It must
 * never be collapsed into a gap-stripped string: clearing a middle cell would shift every later digit
 * left, so the rendered cells would stop matching what the user typed.
 *
 * Two shapes of input land on a cell: a single typed digit (advance one cell), or several digits at
 * once - a paste, OR a browser autofilling the whole code into the first cell (its input carries
 * autoComplete="one-time-code"). applyOtpInput handles both with one rule: strip non-digits, then write
 * the digits across the cells starting at the edited index.
 */

export type OtpCells = readonly string[]

export function emptyOtpCells(length: number): string[] {
  return Array.from({ length }, () => "")
}

/** True once every cell holds a digit. */
export function isOtpComplete(cells: OtpCells): boolean {
  return cells.length > 0 && cells.every((cell) => cell !== "")
}

/** The code to submit, or null while any cell is still empty. */
export function otpCode(cells: OtpCells): string | null {
  return isOtpComplete(cells) ? cells.join("") : null
}

export interface OtpInputResult {
  cells: string[]
  /** Where focus should move: the last cell we wrote, or the next empty cell after it. */
  focusIndex: number
  /** True when every cell is filled and the code should be auto-submitted. */
  complete: boolean
}

/**
 * Apply `raw` text entered at cell `index` to the current `prev` cells.
 *
 * - Single digit: set that one cell and advance focus by one (classic per-cell typing).
 * - Multiple digits (paste, or one-time-code autofill dumped into a single cell): distribute them
 *   across consecutive cells starting at `index`, capped at the last cell.
 * - Empty / non-digit input: clears the edited cell (e.g. selecting a digit and deleting it).
 *
 * Pure: no refs, no focus side effects - the caller moves focus and triggers verify.
 */
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

  // Prefer the next empty cell after what we wrote; otherwise sit on the last written cell.
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
