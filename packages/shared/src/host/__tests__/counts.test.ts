import { describe, expect, it } from "vitest"
import { ADDRESS_PRECISION_LADDER } from "../../address.js"
import { ANALYTICS_SUPPRESSION_K } from "../../schemas/host/analytics.js"
import { K_SUPPRESS } from "../suppress.js"

describe("shared privacy and ranking constants", () => {
  it("uses one k-anonymity floor for client-side suppression and the analytics schema default", () => {
    expect(K_SUPPRESS).toBe(ANALYTICS_SUPPRESSION_K)
    expect(K_SUPPRESS).toBe(5)
  })

  it("ranks address precision from the most to the least precise", () => {
    expect(ADDRESS_PRECISION_LADDER).toEqual(["street", "intersection", "landmark", "locality"])
  })
})
