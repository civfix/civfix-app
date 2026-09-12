import { beforeEach, describe, expect, it } from "vitest"
import { keyboardHostReserveStore } from "../keyboardHostReserveStore"

describe("keyboardHostReserveStore", () => {
  beforeEach(() => keyboardHostReserveStore.reset())

  it("reports nothing reserved until a pinned surface claims it", () => {
    expect(keyboardHostReserveStore.getState()).toBe(false)
    const release = keyboardHostReserveStore.claim()
    expect(keyboardHostReserveStore.getState()).toBe(true)
    release()
    expect(keyboardHostReserveStore.getState()).toBe(false)
  })

  it("counts claims, so a second surface keeps the reservation alive", () => {
    const first = keyboardHostReserveStore.claim()
    const second = keyboardHostReserveStore.claim()
    first()
    expect(keyboardHostReserveStore.getState()).toBe(true)
    second()
    expect(keyboardHostReserveStore.getState()).toBe(false)
  })

  it("ignores a release that already ran", () => {
    const release = keyboardHostReserveStore.claim()
    keyboardHostReserveStore.claim()
    release()
    release()
    expect(keyboardHostReserveStore.getState()).toBe(true)
  })

  it("notifies subscribers on every change", () => {
    const seen: boolean[] = []
    const unsubscribe = keyboardHostReserveStore.subscribe(() =>
      seen.push(keyboardHostReserveStore.getState()),
    )
    keyboardHostReserveStore.claim()()
    unsubscribe()
    expect(seen).toEqual([true, false])
  })
})
