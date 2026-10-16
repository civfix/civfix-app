import { describe, expect, it } from "vitest"
import { IdSchema } from "@civfix/contract"
import { stripTrailingSlashes } from "../url"
import { isUuid } from "../uuid"

describe("isUuid", () => {
  const cases = [
    "11111111-2222-4333-8444-555555555555",
    "ABCDEF01-2345-6789-ABCD-EF0123456789",
    "abcdef01-2345-6789-abcd-ef0123456789",
    "00000000-0000-0000-0000-000000000000",
    "",
    "not-a-uuid",
    "11111111-2222-4333-8444-55555555555",
    "11111111-2222-4333-8444-5555555555555",
    "11111111222243338444555555555555",
    " 11111111-2222-4333-8444-555555555555",
    "g1111111-2222-4333-8444-555555555555",
  ]

  it("accepts upper and lower case and rejects malformed values", () => {
    expect(isUuid("11111111-2222-4333-8444-555555555555")).toBe(true)
    expect(isUuid("ABCDEF01-2345-6789-ABCD-EF0123456789")).toBe(true)
    expect(isUuid("11111111222243338444555555555555")).toBe(false)
    expect(isUuid(" 11111111-2222-4333-8444-555555555555")).toBe(false)
  })

  it("agrees with IdSchema on every case", () => {
    for (const value of cases) expect(isUuid(value)).toBe(IdSchema.safeParse(value).success)
  })
})

describe("stripTrailingSlashes", () => {
  it("removes every trailing slash and nothing else", () => {
    expect(stripTrailingSlashes("https://api.example.org")).toBe("https://api.example.org")
    expect(stripTrailingSlashes("https://api.example.org/")).toBe("https://api.example.org")
    expect(stripTrailingSlashes("https://api.example.org/v1///")).toBe("https://api.example.org/v1")
    expect(stripTrailingSlashes("/a//b/")).toBe("/a//b")
    expect(stripTrailingSlashes("///")).toBe("")
    expect(stripTrailingSlashes("")).toBe("")
  })
})
