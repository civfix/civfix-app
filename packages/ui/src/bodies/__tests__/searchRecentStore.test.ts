import { beforeEach, describe, expect, it } from "vitest"
import {
  SEARCH_RECENT_LIMIT,
  SEARCH_RECENT_MIN_LENGTH,
  SEARCH_RECENT_STORAGE_KEY,
  discardSearchInput,
  pendingSearchInput,
  searchRecentCommit,
  trackSearchInput,
  useSearchRecentStore,
} from "../searchRecentStore"

beforeEach(() => {
  useSearchRecentStore.setState({ recent: [] })
  discardSearchInput()
})

describe("searchRecentStore", () => {
  it("records a trimmed query once and promotes it when searched again", () => {
    const store = useSearchRecentStore.getState()
    store.record("  Echo Park  ")
    store.record("Boyle Heights")
    store.record("echo park")

    expect(useSearchRecentStore.getState().recent).toEqual(["echo park", "Boyle Heights"])
  })

  it("ignores blank queries and retains only the most recent searches", () => {
    const store = useSearchRecentStore.getState()
    store.record("   ")
    for (let index = 0; index < SEARCH_RECENT_LIMIT + 2; index += 1) {
      store.record(`Search ${index}`)
    }

    expect(useSearchRecentStore.getState().recent).toEqual(
      Array.from({ length: SEARCH_RECENT_LIMIT }, (_, index) => `Search ${SEARCH_RECENT_LIMIT + 1 - index}`),
    )
  })

  it("commits a normalized query, collapsing whitespace", () => {
    expect(searchRecentCommit("  Echo   Park  ")).toBe("Echo Park")
    expect(searchRecentCommit("LA")).toBe("LA")
  })

  it("refuses blank and single-character commits", () => {
    expect(searchRecentCommit("")).toBeNull()
    expect(searchRecentCommit("   ")).toBeNull()
    expect(searchRecentCommit("e")).toBeNull()
    expect(SEARCH_RECENT_MIN_LENGTH).toBe(2)
  })

  it("keeps the PREFIXES of one search out of the list - the whole point of committing", () => {
    const typed = ["e", "ec", "ech", "echo", "echo p", "echo park"]
    const committed = searchRecentCommit(typed[typed.length - 1] as string)
    useSearchRecentStore.getState().record(committed as string)

    expect(useSearchRecentStore.getState().recent).toEqual(["echo park"])
    expect(typed.filter((partial) => searchRecentCommit(partial) === null)).toEqual(["e"])
  })

  it("holds the last non-empty input, so a nav-driven query reset still commits what was typed", () => {
    trackSearchInput("echo")
    trackSearchInput("echo park")
    trackSearchInput("")

    expect(pendingSearchInput()).toBe("echo park")
  })

  it("drops the pending input on an explicit clear, so a later blur records NOTHING", () => {
    trackSearchInput("echo park")
    discardSearchInput()

    expect(pendingSearchInput()).toBe("")
    expect(searchRecentCommit(pendingSearchInput())).toBeNull()
  })

  it("re-arms after a clear: typing again is committable", () => {
    trackSearchInput("echo park")
    discardSearchInput()
    trackSearchInput("boyle heights")

    expect(searchRecentCommit(pendingSearchInput())).toBe("boyle heights")
  })

  it("clears persisted recent searches", () => {
    const store = useSearchRecentStore.getState()
    store.record("Sunset Boulevard")
    store.clear()

    expect(useSearchRecentStore.getState().recent).toEqual([])
    expect(useSearchRecentStore.persist.getOptions().name).toBe(SEARCH_RECENT_STORAGE_KEY)
  })
})
