"use client"

import * as React from "react"

import { applyOtpInput, emptyOtpCells, otpCode } from "@/lib/otp"

export interface OtpEntry {
  cells: string[]
  refs: React.MutableRefObject<Array<HTMLInputElement | null>>
  type(index: number, raw: string): string | null
  paste(text: string): string | null
  clear(): void
  onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>): void
}

export function useOtpEntry(length: number): OtpEntry {
  const [cells, setCells] = React.useState<string[]>(() => emptyOtpCells(length))
  const refs = React.useRef<Array<HTMLInputElement | null>>([])
  const clear = React.useCallback(() => setCells(emptyOtpCells(length)), [length])

  const apply = (start: readonly string[], index: number, raw: string): string | null => {
    const { cells: next, focusIndex } = applyOtpInput(start, index, raw)
    setCells(next)
    refs.current[focusIndex]?.focus()
    return otpCode(next)
  }

  return {
    cells,
    refs,
    type: (index, raw) => apply(cells, index, raw),
    paste: (text) => apply(emptyOtpCells(length), 0, text),
    clear,
    onKeyDown: (index, event) => {
      if (event.key === "Backspace" && !cells[index] && index > 0) {
        refs.current[index - 1]?.focus()
      }
    },
  }
}
