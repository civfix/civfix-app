import { describe, expect, it } from "vitest"

import { MAX_TOASTS, withinCap } from "./toast-policy"

interface Item {
  id: string
}

describe("toast policy", () => {
  it("appends while under the cap", () => {
    const items: Item[] = [{ id: "a" }]
    expect(withinCap(items, { id: "b" }).map((i) => i.id)).toEqual(["a", "b"])
  })

  it("evicts the oldest toast at the cap", () => {
    const items: Item[] = [{ id: "one" }, { id: "two" }, { id: "three" }, { id: "four" }]
    expect(withinCap(items, { id: "new" }, MAX_TOASTS).map((i) => i.id)).toEqual([
      "two",
      "three",
      "four",
      "new",
    ])
  })

  it("never grows past the cap", () => {
    let items: Item[] = []
    for (let i = 0; i < MAX_TOASTS * 3; i += 1) items = withinCap(items, { id: `t${i}` }, MAX_TOASTS)
    expect(items).toHaveLength(MAX_TOASTS)
    expect(items[items.length - 1]?.id).toBe(`t${MAX_TOASTS * 3 - 1}`)
  })
})
