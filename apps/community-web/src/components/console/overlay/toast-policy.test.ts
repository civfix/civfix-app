import { describe, expect, it } from "vitest"

import {
  DEFAULT_TOAST_DURATION_MS,
  MAX_TOASTS,
  UNDO_TOAST_DURATION_MS,
  resolveUndoDuration,
  withinCap,
} from "./toast-policy"

interface Item {
  id: string
  action?: { label: string }
}

describe("toast policy", () => {
  it("gives an undo toast at least the undo window", () => {
    expect(resolveUndoDuration()).toBe(UNDO_TOAST_DURATION_MS)
    expect(resolveUndoDuration(1000)).toBe(UNDO_TOAST_DURATION_MS)
    expect(resolveUndoDuration(30_000)).toBe(30_000)
    expect(UNDO_TOAST_DURATION_MS).toBeGreaterThan(DEFAULT_TOAST_DURATION_MS)
  })

  it("appends while under the cap", () => {
    const items: Item[] = [{ id: "a" }]
    expect(withinCap(items, { id: "b" }).map((i) => i.id)).toEqual(["a", "b"])
  })

  it("evicts the oldest ACTIONLESS toast at the cap, never an undo", () => {
    const items: Item[] = [
      { id: "undo1", action: { label: "Undo" } },
      { id: "plain1" },
      { id: "undo2", action: { label: "Undo" } },
      { id: "plain2" },
    ]
    expect(withinCap(items, { id: "new" }, MAX_TOASTS).map((i) => i.id)).toEqual([
      "undo1",
      "undo2",
      "plain2",
      "new",
    ])
  })

  it("exceeds the cap rather than dropping an undo the user might still need", () => {
    const items: Item[] = Array.from({ length: MAX_TOASTS }, (_, i) => ({
      id: `u${i}`,
      action: { label: "Undo" },
    }))
    expect(withinCap(items, { id: "new" }, MAX_TOASTS)).toHaveLength(MAX_TOASTS + 1)
  })
})
