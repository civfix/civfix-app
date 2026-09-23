/**
 * The API client does not reject a drifted or empty response (it passes the raw body through, or
 * `undefined` for a 204), so a queryFn that returns `res.items` bare can resolve `undefined` or throw on
 * `undefined.items`, both of which land a list surface on its error state instead of an empty list.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { listItems } from "../types"

describe("listItems", () => {
  it("passes a real list through", () => {
    expect(listItems([1, 2])).toEqual([1, 2])
  })

  it("coerces a missing list to an empty array", () => {
    expect(listItems(undefined)).toEqual([])
    expect(listItems(null)).toEqual([])
  })

  it("drops null entries", () => {
    expect(listItems([1, null, 2, undefined])).toEqual([1, 2])
  })

  it("treats a non-array envelope field as empty", () => {
    expect(listItems({ items: [] } as unknown as number[])).toEqual([])
  })
})

describe("list queryFns coerce their envelope", () => {
  const files = ["cleanups.ts", "orgs.ts", "host.ts", "notifications.ts", "social.ts"]
  it.each(files)("%s never returns a bare `.items` / `.results` from a queryFn", (file) => {
    const src = readFileSync(join(__dirname, "..", "hooks", file), "utf8")
    expect(src).not.toMatch(/queryFn: async \(\) => \(await api\.\w+\([^)]*\)\)\.items,/)
    expect(src).not.toMatch(/return res\.results\n/)
  })
})
