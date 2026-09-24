import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { AppError } from "@civfix/shared"
import { rosterMutationErrorKey } from "../rosterFiltersModel"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

describe("rosterMutationErrorKey", () => {
  it("names a missing check-in permission, which the server sends as FORBIDDEN", () => {
    expect(rosterMutationErrorKey(AppError.forbidden("nope"))).toBe("roster.error_forbidden")
    expect(rosterMutationErrorKey({ name: "AppError", code: "FORBIDDEN" })).toBe(
      "roster.error_forbidden",
    )
  })

  it("keeps the generic copy for every other failure", () => {
    expect(rosterMutationErrorKey(AppError.notFound("gone"))).toBe("roster.error")
    expect(rosterMutationErrorKey(new Error("offline"))).toBe("roster.error")
    expect(rosterMutationErrorKey(undefined)).toBe("roster.error")
  })
})

describe("both roster surfaces toast a failed check-in or undo the same way", () => {
  it.each(["../EventRosterBlock.tsx", "../checkin/useCheckinRoster.ts"])("%s", (file) => {
    const src = read(file)
    expect(src).toMatch(/\(rosterMutationErrorKey\(err\)\)/)
    expect(src).not.toContain('toast.show(tRoster("roster.error")')
  })
})
