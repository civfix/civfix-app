import { describe, expect, it } from "vitest"
import { withTextOffsets, withValueKeys } from "../listKeys"

describe("withTextOffsets", () => {
  it("keys each run by where it starts, so a repeated mention keeps a key of its own", () => {
    const runs = [
      { kind: "mention", text: "@ana" },
      { kind: "text", text: " and " },
      { kind: "mention", text: "@ana" },
    ]
    expect(withTextOffsets(runs).map((run) => run.offset)).toEqual([0, 4, 9])
  })

  it("leaves each run's own fields untouched", () => {
    expect(withTextOffsets([{ kind: "text", text: "hi" }])).toEqual([{ kind: "text", text: "hi", offset: 0 }])
  })
})

describe("withValueKeys", () => {
  it("keys a value by itself and numbers its repeats", () => {
    expect(withValueKeys(["gloves", "bags", "gloves"])).toEqual([
      { value: "gloves", key: "0:gloves" },
      { value: "bags", key: "0:bags" },
      { value: "gloves", key: "1:gloves" },
    ])
  })

  it("cannot collide with a value that looks like a numbered key", () => {
    const keys = withValueKeys(["x", "x", "1:x"]).map((entry) => entry.key)
    expect(new Set(keys).size).toBe(3)
  })
})
