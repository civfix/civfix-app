import { describe, expect, it } from "vitest"
import { shouldOfferChannelSkip } from "../channelSkip"

describe("shouldOfferChannelSkip", () => {
  it("offers Skip on the members step while nothing is selected", () => {
    expect(shouldOfferChannelSkip("members", 0)).toBe(true)
  })

  it("hides Skip once subscribers are selected (Skip shares onCreate, which submits the selection)", () => {
    // A visible Skip here would create the channel WITH the picked subscribers: a mislabeled Create.
    expect(shouldOfferChannelSkip("members", 1)).toBe(false)
    expect(shouldOfferChannelSkip("members", 7)).toBe(false)
  })

  it("never offers Skip on the earlier steps", () => {
    expect(shouldOfferChannelSkip("identity", 0)).toBe(false)
    expect(shouldOfferChannelSkip("visibility", 0)).toBe(false)
  })
})
