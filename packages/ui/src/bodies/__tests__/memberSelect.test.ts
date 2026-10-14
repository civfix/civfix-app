import { describe, expect, it } from "vitest"
import type { PersonDTO, UserSearchResultDTO } from "@civfix/shared"
import { toggleMember, removeMember, filterExcluded, searchResultToPerson } from "../memberSelect"

function person(id: string, name = `Person ${id}`): PersonDTO {
  return {
    id,
    name,
    handle: `h_${id}`,
    avatar: ["#111111", "#222222"],
    avatarUrl: null,
    followers: 0,
    following: 0,
    isFollowing: false,
  }
}

describe("toggleMember", () => {
  it("adds an unselected person", () => {
    const a = person("a")
    expect(toggleMember([], a)).toEqual([a])
  })

  it("appends in order (later picks go after earlier ones)", () => {
    const a = person("a")
    const b = person("b")
    expect(toggleMember([a], b)).toEqual([a, b])
  })

  it("removes an already-selected person (toggle off) by id", () => {
    const a = person("a")
    const b = person("b")
    // A DIFFERENT object with the same id still toggles off - identity is the id, not the reference.
    expect(toggleMember([a, b], person("a", "Renamed"))).toEqual([b])
  })

  it("never duplicates: toggling twice returns to the original selection", () => {
    const a = person("a")
    const once = toggleMember([], a)
    expect(toggleMember(once, a)).toEqual([])
  })

  it("is a same-reference no-op for an excluded person", () => {
    const selected = [person("a")]
    expect(toggleMember(selected, person("x"), ["x"])).toBe(selected)
  })

  it("exclusion does NOT block removing someone already selected", () => {
    const a = person("a")
    // Defensive: if an already-selected id later becomes excluded, toggling still removes it.
    expect(toggleMember([a], a, ["a"])).toEqual([])
  })
})

describe("removeMember", () => {
  it("removes by id", () => {
    const a = person("a")
    const b = person("b")
    expect(removeMember([a, b], "a")).toEqual([b])
  })

  it("is a same-reference no-op when the id is not selected", () => {
    const selected = [person("a")]
    expect(removeMember(selected, "zzz")).toBe(selected)
  })
})

describe("filterExcluded", () => {
  it("drops excluded ids from results", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }]
    expect(filterExcluded(rows, ["b"])).toEqual([{ id: "a" }, { id: "c" }])
  })

  it("returns everything when there is nothing to exclude", () => {
    const rows = [{ id: "a" }]
    expect(filterExcluded(rows)).toEqual(rows)
    expect(filterExcluded(rows, [])).toEqual(rows)
  })
})

describe("searchResultToPerson", () => {
  it("maps the @handle search DTO onto a PersonDTO (zero-filled social counts)", () => {
    const hit: UserSearchResultDTO = {
      id: "u1",
      handle: "ada",
      displayName: "Ada L",
      avatar: ["#111111", "#222222"],
      avatarUrl: "https://cdn/x.jpg",
    }
    expect(searchResultToPerson(hit)).toEqual({
      id: "u1",
      name: "Ada L",
      handle: "ada",
      avatar: ["#111111", "#222222"],
      avatarUrl: "https://cdn/x.jpg",
      followers: 0,
      following: 0,
      isFollowing: false,
    })
  })

  it("normalizes a missing avatarUrl to null", () => {
    const hit: UserSearchResultDTO = {
      id: "u2",
      handle: "bo",
      displayName: "Bo",
      avatar: ["#111111", "#222222"],
    }
    expect(searchResultToPerson(hit).avatarUrl).toBeNull()
  })
})
