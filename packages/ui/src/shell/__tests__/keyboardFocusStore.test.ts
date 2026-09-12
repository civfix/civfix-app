import { beforeEach, describe, expect, it } from "vitest"
import { keyboardFocusStore, type KeyboardFocusNode } from "../keyboardFocusStore"

const node = (): KeyboardFocusNode => ({ measureInWindow: () => {} })

describe("keyboardFocusStore", () => {
  beforeEach(() => keyboardFocusStore.reset())

  it("records the focused node with the scroller scope it was rendered in", () => {
    const field = node()
    keyboardFocusStore.setFocused(field, "scope-a")
    expect(keyboardFocusStore.getState().node).toBe(field)
    expect(keyboardFocusStore.getState().scope).toBe("scope-a")
  })

  it("is last-writer-wins: focusing the next field replaces the previous one", () => {
    const first = node()
    const second = node()
    keyboardFocusStore.setFocused(first, "scope-a")
    keyboardFocusStore.setFocused(second, "scope-b")
    expect(keyboardFocusStore.getState().node).toBe(second)
    expect(keyboardFocusStore.getState().scope).toBe("scope-b")
  })

  it("ignores the STALE blur that follows a focus switch by one tick", () => {
    const first = node()
    const second = node()
    keyboardFocusStore.setFocused(first, "scope-a")
    keyboardFocusStore.setFocused(second, "scope-a")
    keyboardFocusStore.clearFocused(first)
    expect(keyboardFocusStore.getState().node).toBe(second)
  })

  it("clears on the blur of the field that still holds focus", () => {
    const field = node()
    keyboardFocusStore.setFocused(field, "scope-a")
    keyboardFocusStore.clearFocused(field)
    expect(keyboardFocusStore.getState().node).toBeNull()
    expect(keyboardFocusStore.getState().scope).toBeNull()
  })

  it("carries the reveal group the field declared, and drops it with the focus", () => {
    const field = node()
    const group = node()
    keyboardFocusStore.setFocused(field, "scope-a", group)
    expect(keyboardFocusStore.getState().revealNode).toBe(group)
    keyboardFocusStore.clearFocused(field)
    expect(keyboardFocusStore.getState().revealNode).toBeNull()
  })

  it("keeps the version monotonic across focus, growth and blur", () => {
    const field = node()
    const seen: number[] = []
    const unsubscribe = keyboardFocusStore.subscribe(() => seen.push(keyboardFocusStore.getState().version))
    keyboardFocusStore.setFocused(field, "scope-a")
    keyboardFocusStore.bump()
    keyboardFocusStore.clearFocused(field)
    unsubscribe()
    expect(seen).toEqual([1, 2, 3])
  })

  it("bumps nothing while no field is focused", () => {
    keyboardFocusStore.bump()
    expect(keyboardFocusStore.getState().version).toBe(0)
  })

  it("stops notifying an unsubscribed listener", () => {
    let calls = 0
    const unsubscribe = keyboardFocusStore.subscribe(() => {
      calls += 1
    })
    unsubscribe()
    keyboardFocusStore.setFocused(node(), "scope-a")
    expect(calls).toBe(0)
  })
})
