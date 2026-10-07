import { describe, expect, it } from "vitest"
import { EMPTY_VALUE } from "../emptyValue"
import * as i18n from "../index"

describe("the shared empty-value mark", () => {
  it("is one visible character and never an em dash", () => {
    expect(EMPTY_VALUE).toHaveLength(1)
    expect(EMPTY_VALUE.trim()).toBe(EMPTY_VALUE)
    expect(EMPTY_VALUE).not.toBe("\u2014")
  })

  it("is exported from the i18n entry the host console may import", () => {
    expect(i18n.EMPTY_VALUE).toBe(EMPTY_VALUE)
  })
})
