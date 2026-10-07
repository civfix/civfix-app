import { describe, expect, it } from "vitest"
import { IdSchema } from "../src/schemas/common.js"
import * as units from "../src/time-units.js"
import { stripTrailingSlashes } from "../src/url.js"
import { isUuid } from "../src/uuid.js"

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

describe("time units", () => {
  it("holds the backend's values", () => {
    expect({ ...units }).toEqual({
      MS_PER_SECOND: 1000,
      SECONDS_PER_MINUTE: 60,
      MINUTES_PER_HOUR: 60,
      SECONDS_PER_HOUR: 3600,
      SECONDS_PER_DAY: 86_400,
      MS_PER_MINUTE: 60_000,
      MS_PER_HOUR: 3_600_000,
      MS_PER_DAY: 86_400_000,
      MS_PER_WEEK: 604_800_000,
    })
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
