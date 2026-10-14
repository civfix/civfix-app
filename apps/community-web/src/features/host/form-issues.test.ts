import { describe, expect, it } from "vitest"

import { firstIssueByPath } from "./form-issues"

const issues = [
  { path: ["socialLinks", "instagram"], message: "bad handle" },
  { path: ["socialLinks", "x"], message: "bad x" },
  { path: ["name"], message: "too long" },
  { path: ["name"], message: "second name issue" },
  { path: [], message: "form level" },
]

describe("firstIssueByPath", () => {
  it("keys by the top-level field and keeps the first message per field", () => {
    expect(firstIssueByPath(issues, "field")).toEqual({
      socialLinks: "bad handle",
      name: "too long",
      form: "form level",
    })
  })

  it("keys by the full dotted path", () => {
    expect(firstIssueByPath(issues, "path")).toEqual({
      "socialLinks.instagram": "bad handle",
      "socialLinks.x": "bad x",
      name: "too long",
      form: "form level",
    })
  })

  it("never overwrites a message the seed already holds, and leaves the seed untouched", () => {
    const seed = { name: "local check" }
    expect(firstIssueByPath(issues, "field", seed)).toEqual({
      socialLinks: "bad handle",
      name: "local check",
      form: "form level",
    })
    expect(seed).toEqual({ name: "local check" })
  })
})
