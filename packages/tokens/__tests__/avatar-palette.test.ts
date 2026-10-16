import { describe, expect, it } from "vitest"
import { AVATAR_PALETTE } from "@civfix/contract/avatar"
import { tokens } from "../src/design-tokens.js"

// The contract copies the avatar palette instead of importing the tokens, so the backend never pulls
// a UI package in. This keeps the copy honest.
describe("the contract's avatar palette", () => {
  it("is the brand 500 shades in bloom, moss, sun, sky, lilac order", () => {
    expect(AVATAR_PALETTE).toEqual([
      tokens.color.brand.bloom,
      tokens.color.brand.moss,
      tokens.color.brand.sun,
      tokens.color.brand.sky,
      tokens.color.brand.lilac,
    ])
  })

  it("excludes the sunDark accent", () => {
    expect(AVATAR_PALETTE as readonly string[]).not.toContain(tokens.color.brand.sunDark)
  })
})
