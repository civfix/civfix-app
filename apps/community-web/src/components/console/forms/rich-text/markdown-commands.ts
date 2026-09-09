import { isSafeMarkdownHref } from "@civfix/shared/markdown"

export interface TextSelection {
  value: string
  start: number
  end: number
}

export interface CommandResult {
  value: string
  start: number
  end: number
}

function slice(sel: TextSelection): string {
  return sel.value.slice(sel.start, sel.end)
}

function replace(sel: TextSelection, text: string, start: number, end: number): CommandResult {
  return {
    value: `${sel.value.slice(0, sel.start)}${text}${sel.value.slice(sel.end)}`,
    start,
    end,
  }
}

function wrapped(sel: TextSelection, marker: string): boolean {
  const before = sel.value.slice(sel.start - marker.length, sel.start)
  const after = sel.value.slice(sel.end, sel.end + marker.length)
  if (before === marker && after === marker) return true
  const inner = slice(sel)
  return (
    inner.length >= marker.length * 2 &&
    inner.startsWith(marker) &&
    inner.endsWith(marker)
  )
}

export function toggleWrap(sel: TextSelection, marker: string): CommandResult {
  const inner = slice(sel)

  const outerBefore = sel.value.slice(sel.start - marker.length, sel.start)
  const outerAfter = sel.value.slice(sel.end, sel.end + marker.length)
  if (outerBefore === marker && outerAfter === marker) {
    const value =
      sel.value.slice(0, sel.start - marker.length) +
      inner +
      sel.value.slice(sel.end + marker.length)
    return { value, start: sel.start - marker.length, end: sel.end - marker.length }
  }

  if (wrapped(sel, marker)) {
    const stripped = inner.slice(marker.length, inner.length - marker.length)
    return replace(sel, stripped, sel.start, sel.start + stripped.length)
  }

  const next = `${marker}${inner}${marker}`
  return replace(
    sel,
    next,
    sel.start + marker.length,
    sel.start + marker.length + inner.length,
  )
}

export function toggleBold(sel: TextSelection): CommandResult {
  return toggleWrap(sel, "**")
}

export function toggleItalic(sel: TextSelection): CommandResult {
  return toggleWrap(sel, "_")
}

export function isInsertableLinkHref(href: string): boolean {
  const trimmed = href.trim()
  if (trimmed.length === 0) return false
  if (/[()<>]/.test(trimmed)) return false
  return isSafeMarkdownHref(trimmed)
}

export function insertLink(sel: TextSelection, href: string): CommandResult | null {
  if (!isInsertableLinkHref(href)) return null
  const text = slice(sel)
  const label = text.length > 0 ? text : href
  const next = `[${label}](${href.trim()})`
  return replace(sel, next, sel.start + 1, sel.start + 1 + label.length)
}

function lineBoundsAt(value: string, index: number): [number, number] {
  const start = value.lastIndexOf("\n", Math.max(0, index - 1)) + 1
  const nextBreak = value.indexOf("\n", index)
  return [start, nextBreak === -1 ? value.length : nextBreak]
}

function selectedLines(sel: TextSelection): { start: number; end: number; lines: string[] } {
  const [start] = lineBoundsAt(sel.value, sel.start)
  const [, end] = lineBoundsAt(sel.value, sel.end)
  return { start, end, lines: sel.value.slice(start, end).split("\n") }
}

const BULLET = /^\s*[-*]\s+/
const ORDERED = /^\s*\d+[.)]\s+/

export function toggleBulletList(sel: TextSelection): CommandResult {
  const { start, end, lines } = selectedLines(sel)
  const allBulleted = lines.every((line) => line.trim() === "" || BULLET.test(line))
  const next = lines
    .map((line) => {
      if (line.trim() === "") return line
      if (allBulleted) return line.replace(BULLET, "")
      return `- ${line.replace(ORDERED, "")}`
    })
    .join("\n")
  const value = sel.value.slice(0, start) + next + sel.value.slice(end)
  return { value, start, end: start + next.length }
}

export function toggleOrderedList(sel: TextSelection): CommandResult {
  const { start, end, lines } = selectedLines(sel)
  const allOrdered = lines.every((line) => line.trim() === "" || ORDERED.test(line))
  let counter = 0
  const next = lines
    .map((line) => {
      if (line.trim() === "") return line
      if (allOrdered) return line.replace(ORDERED, "")
      counter += 1
      return `${counter}. ${line.replace(BULLET, "")}`
    })
    .join("\n")
  const value = sel.value.slice(0, start) + next + sel.value.slice(end)
  return { value, start, end: start + next.length }
}
