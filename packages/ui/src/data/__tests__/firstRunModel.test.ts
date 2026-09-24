import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { UpdateProfileRequestSchema } from "@civfix/shared"
import {
  DISPLAY_NAME_MAX,
  FIRST_NAME_MAX,
  LAST_NAME_MAX,
  firstRunModel,
  splitName,
  stripHandlePrefix,
  type FirstRunInput,
} from "../firstRunModel"

const READY: FirstRunInput = {
  first: "Ada",
  last: "Lovelace",
  handle: "ada_l",
  checkedHandle: "ada_l",
  availability: { data: { available: true }, isFetching: false, isError: false },
  ageConfirmed: true,
  termsConfirmed: true,
  submitting: false,
}

const model = (over: Partial<FirstRunInput> = {}) => firstRunModel({ ...READY, ...over })

describe("first-run name caps", () => {
  it("uses the display-name cap the profile save validates against", () => {
    expect(DISPLAY_NAME_MAX).toBe(UpdateProfileRequestSchema.shape.displayName.maxLength)
  })

  it("fits the first and last name caps plus the joining space inside the display name cap", () => {
    expect(FIRST_NAME_MAX).toBeLessThan(DISPLAY_NAME_MAX - 1)
    expect(FIRST_NAME_MAX + 1 + LAST_NAME_MAX).toBe(DISPLAY_NAME_MAX)
  })

  it("never lets a seeded name longer than the cap be submitted", () => {
    const view = model({ first: "a".repeat(50), last: "b".repeat(35) })
    expect(view.displayName.length).toBeGreaterThan(DISPLAY_NAME_MAX)
    expect(view.canSubmit).toBe(false)
    expect(model({ first: "a".repeat(40), last: "b".repeat(39) }).canSubmit).toBe(true)
  })
})

describe("splitName", () => {
  it("seeds the first word as the first name and the rest as the last name", () => {
    expect(splitName("  Ada   King Lovelace ")).toEqual({ first: "Ada", last: "King Lovelace" })
    expect(splitName("Ada")).toEqual({ first: "Ada", last: "" })
    expect(splitName("   ")).toEqual({ first: "", last: "" })
  })
})

describe("stripHandlePrefix", () => {
  it("drops only leading @ signs", () => {
    expect(stripHandlePrefix("@@ada@x")).toBe("ada@x")
    expect(stripHandlePrefix("ada")).toBe("ada")
  })
})

describe("firstRunModel", () => {
  it("submits a checked, available handle with a name and both confirmations", () => {
    expect(model()).toMatchObject({
      trimmedHandle: "ada_l",
      handleValid: true,
      displayName: "Ada Lovelace",
      previewName: "ada_l",
      checking: false,
      available: true,
      taken: false,
      checkFailed: false,
      canSubmit: true,
    })
  })

  it("requires every submit condition", () => {
    expect(model({ first: " ", last: "" }).canSubmit).toBe(false)
    expect(model({ ageConfirmed: false }).canSubmit).toBe(false)
    expect(model({ termsConfirmed: false }).canSubmit).toBe(false)
    expect(model({ submitting: true }).canSubmit).toBe(false)
    expect(model({ handle: "a", checkedHandle: "a" }).canSubmit).toBe(false)
  })

  it("treats the previous handle's answer as unchecked until the debounce catches up", () => {
    const view = model({ handle: "ada_lo", checkedHandle: "ada_l" })
    expect(view.checking).toBe(true)
    expect(view.available).toBe(false)
    expect(view.canSubmit).toBe(false)
  })

  it("reports a taken handle only for the handle it was checked for", () => {
    const taken = { data: { available: false }, isFetching: false, isError: false }
    expect(model({ availability: taken }).taken).toBe(true)
    expect(model({ availability: taken, handle: "other1" }).taken).toBe(false)
  })

  it("reports a failed check once the request settles, and not while a retry is in flight", () => {
    const failed = { isFetching: false, isError: true }
    expect(model({ availability: failed })).toMatchObject({ checkFailed: true, checking: false, canSubmit: false })
    expect(model({ availability: { ...failed, isFetching: true } })).toMatchObject({
      checkFailed: false,
      checking: true,
    })
  })

  it("says nothing about availability for an invalid handle", () => {
    const view = model({ handle: "a!", checkedHandle: "a!" })
    expect(view).toMatchObject({ handleValid: false, checking: false, available: false, taken: false, checkFailed: false })
  })

  it("previews the handle, then the name, then a placeholder", () => {
    expect(model({ handle: " ", checkedHandle: "" }).previewName).toBe("Ada Lovelace")
    expect(model({ handle: "", checkedHandle: "", first: "", last: "" }).previewName).toBe("?")
  })
})

describe("the shared handle check both first-run screens use", () => {
  const social = readFileSync(new URL("../hooks/social.ts", import.meta.url), "utf8")

  it("waits 300 ms after the last keystroke and keeps an answer for 30 s", () => {
    expect(social).toContain("const HANDLE_AVAILABILITY_DEBOUNCE_MS = 300\n")
    expect(social).toContain("const HANDLE_AVAILABILITY_STALE_MS = 30_000\n")
    expect(social).toContain("useDebouncedValue(handle.trim(), HANDLE_AVAILABILITY_DEBOUNCE_MS)")
    expect(social).toContain("staleTime: HANDLE_AVAILABILITY_STALE_MS,")
  })
})
