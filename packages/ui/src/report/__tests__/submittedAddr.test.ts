import { describe, expect, it } from "vitest"
import { submittedAddr } from "../submit"

describe("submittedAddr", () => {
  it("omits a prefill the reporter never touched, so the server records honest provenance", () => {
    expect(submittedAddr({ addr: "123 Main St, Inglewood, CA", addrEdited: false })).toBeUndefined()
  })

  it("sends the line once the reporter has made it theirs", () => {
    expect(submittedAddr({ addr: "  Alley behind the market  ", addrEdited: true })).toBe(
      "Alley behind the market",
    )
  })

  it("sends nothing for an empty or absent field either way", () => {
    expect(submittedAddr({ addr: "   ", addrEdited: true })).toBeUndefined()
    expect(submittedAddr({ addr: null, addrEdited: true })).toBeUndefined()
    expect(submittedAddr({ addr: null, addrEdited: false })).toBeUndefined()
  })
})
