import { describe, expect, it } from "vitest"
import { keyedByValue } from "./list-keys"

describe("keyedByValue", () => {
  it("keys an entry by its value and numbers the repeats", () => {
    const hosts = [{ name: "Ana" }, { name: "Bo" }, { name: "Ana" }]
    expect(keyedByValue(hosts, (host) => host.name).map((row) => row.key)).toEqual([
      "0:Ana",
      "0:Bo",
      "1:Ana",
    ])
  })

  it("keeps a key when an earlier, different entry is removed", () => {
    const before = keyedByValue(["intro", "lunch"], (item) => item)
    const after = keyedByValue(["lunch"], (item) => item)
    expect(after[0]?.key).toBe(before[1]?.key)
  })

  it("cannot collide with a value that looks like a numbered key", () => {
    const keys = keyedByValue(["x", "x", "1:x"], (item) => item).map((row) => row.key)
    expect(new Set(keys).size).toBe(3)
  })
})
