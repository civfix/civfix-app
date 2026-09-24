import { describe, expect, it } from "vitest"

import { moveItem } from "./list-order"

describe("moveItem", () => {
  it("moves an item up and down by one", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"])
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"])
  })

  it("returns an unchanged copy when the target is out of range", () => {
    const list = ["a", "b"]
    const up = moveItem(list, 0, -1)
    expect(up).toEqual(["a", "b"])
    expect(up).not.toBe(list)
    expect(moveItem(list, 1, 1)).toEqual(["a", "b"])
  })

  it("never mutates the input", () => {
    const list = ["a", "b", "c"]
    moveItem(list, 0, 2)
    expect(list).toEqual(["a", "b", "c"])
  })
})
