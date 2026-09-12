import { describe, expect, it } from "vitest"
import { makeKeyboardHostReserveStore } from "../keyboardHostReserveStore"

describe("makeKeyboardHostReserveStore", () => {
  it("reports nothing reserved until a pinned surface of that scope claims it", () => {
    const scope = makeKeyboardHostReserveStore()
    expect(scope.getState()).toBe(false)
    const release = scope.claim()
    expect(scope.getState()).toBe(true)
    release()
    expect(scope.getState()).toBe(false)
  })

  it("counts claims, so a second footer in the SAME scope keeps the reservation alive", () => {
    const scope = makeKeyboardHostReserveStore()
    const first = scope.claim()
    const second = scope.claim()
    first()
    expect(scope.getState()).toBe(true)
    second()
    expect(scope.getState()).toBe(false)
  })

  it("balances an unmount that releases twice, so the count never goes negative", () => {
    const scope = makeKeyboardHostReserveStore()
    const release = scope.claim()
    scope.claim()
    release()
    release()
    expect(scope.getState()).toBe(true)
  })

  it("leaves a FOREIGN scope untouched, so a pushed page reserves its own overlap", () => {
    const wizard = makeKeyboardHostReserveStore()
    const pushed = makeKeyboardHostReserveStore()
    wizard.claim()
    expect(wizard.getState()).toBe(true)
    expect(pushed.getState()).toBe(false)
  })

  it("notifies only its own subscribers, on every change", () => {
    const wizard = makeKeyboardHostReserveStore()
    const pushed = makeKeyboardHostReserveStore()
    const seen: boolean[] = []
    const foreign: boolean[] = []
    const unsubscribe = wizard.subscribe(() => seen.push(wizard.getState()))
    const unsubscribeForeign = pushed.subscribe(() => foreign.push(pushed.getState()))
    wizard.claim()()
    unsubscribe()
    unsubscribeForeign()
    expect(seen).toEqual([true, false])
    expect(foreign).toEqual([])
  })
})
