import { describe, expect, it } from "vitest"
import { personPostsListed } from "../personDetail/personPostsModel"

describe("personPostsListed", () => {
  it("lists posts only once some have loaded", () => {
    expect(personPostsListed({ loading: false, error: false, postItems: [{}] })).toBe(true)
    expect(personPostsListed({ loading: false, error: false, postItems: [] })).toBe(false)
  })

  it("lists nothing while loading or after an error", () => {
    expect(personPostsListed({ loading: true, error: false, postItems: [{}] })).toBe(false)
    expect(personPostsListed({ loading: false, error: true, postItems: [{}] })).toBe(false)
  })
})
