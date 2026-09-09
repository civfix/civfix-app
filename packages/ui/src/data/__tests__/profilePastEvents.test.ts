/**
 * The "Show more past events" controller, pinned at the level `useProfilePastEvents` actually decides
 * things - a pure view + action over the query's observable state, because this package's node-run vitest
 * cannot render a hook.
 *
 * THE REGRESSION THESE EXIST FOR: react-query's `hasNextPage` is FALSE whenever the infinite query holds
 * no pages, so an earlier `canLoadMore = !armed || hasNextPage` hid the control for the whole duration of
 * the first fetch - the only fetch most viewers ever trigger - and, because the query is `retry: false`,
 * hid it forever once that fetch failed, stranding the rest of someone's civic history behind an inert
 * error string. "Exhausted" must mean a SUCCESSFUL page with no cursor after it, never "no pages yet".
 */
import { describe, expect, it } from "vitest"
import {
  profilePastEventsAction,
  profilePastEventsExhausted,
  profilePastEventsView,
  type ProfilePastEventsState,
} from "../hooks/profilePastEventsModel"

const IDLE: ProfilePastEventsState = {
  anchor: "cursor-1",
  armed: false,
  isFetching: false,
  isSuccess: false,
  isError: false,
  hasNextPage: false,
}

const state = (over: Partial<ProfilePastEventsState> = {}): ProfilePastEventsState => ({
  ...IDLE,
  ...over,
})

describe("profilePastEventsView", () => {
  it("offers the control before anything has been fetched", () => {
    expect(profilePastEventsView(IDLE)).toEqual({
      canLoadMore: true,
      isLoadingMore: false,
      isRetry: false,
    })
  })

  it("KEEPS the control mounted, in a busy state, during the arming fetch", () => {
    const view = profilePastEventsView(state({ armed: true, isFetching: true }))
    expect(view.canLoadMore).toBe(true)
    expect(view.isLoadingMore).toBe(true)
  })

  it("KEEPS the control mounted, as a retry, when the arming fetch failed", () => {
    const view = profilePastEventsView(state({ armed: true, isError: true }))
    expect(view.canLoadMore).toBe(true)
    expect(view.isRetry).toBe(true)
  })

  it("keeps offering it while a fetched page still reports a cursor", () => {
    const view = profilePastEventsView(state({ armed: true, isSuccess: true, hasNextPage: true }))
    expect(view.canLoadMore).toBe(true)
    expect(view.isRetry).toBe(false)
  })

  it("retires the control only on a SUCCESSFUL page with nothing after it", () => {
    expect(profilePastEventsView(state({ armed: true, isSuccess: true })).canLoadMore).toBe(false)
    expect(profilePastEventsExhausted(state({ armed: true, isSuccess: true }))).toBe(true)
  })

  it("never treats an unfetched query as exhausted", () => {
    expect(profilePastEventsExhausted(IDLE)).toBe(false)
    expect(profilePastEventsExhausted(state({ armed: true, isFetching: true }))).toBe(false)
    expect(profilePastEventsExhausted(state({ armed: true, isError: true }))).toBe(false)
  })

  it("hides the control entirely when the inline page was the whole history", () => {
    expect(profilePastEventsView(state({ anchor: null })).canLoadMore).toBe(false)
  })

  it("does not render a busy or retry state before the viewer has armed it", () => {
    const view = profilePastEventsView(state({ isFetching: true, isError: true }))
    expect(view.isLoadingMore).toBe(false)
    expect(view.isRetry).toBe(false)
  })
})

describe("profilePastEventsAction", () => {
  it("arms on the first press", () => {
    expect(profilePastEventsAction(IDLE)).toBe("arm")
  })

  it("pages once a fetched page reports a cursor", () => {
    expect(profilePastEventsAction(state({ armed: true, isSuccess: true, hasNextPage: true }))).toBe(
      "next",
    )
  })

  it("retries the FAILED PAGE (not the whole chain) when a next-page fetch failed", () => {
    // hasNextPage still reflects the last SUCCESSFUL page, so re-running fetchNextPage retries
    // exactly the page that failed.
    expect(profilePastEventsAction(state({ armed: true, isError: true, hasNextPage: true }))).toBe(
      "next",
    )
  })

  it("refetches when the ARMING fetch failed and there is no page to continue from", () => {
    expect(profilePastEventsAction(state({ armed: true, isError: true }))).toBe("retry")
  })

  it("does nothing while a fetch is in flight (no double-fetch on a rapid double press)", () => {
    expect(profilePastEventsAction(state({ armed: true, isFetching: true }))).toBe("none")
    expect(profilePastEventsAction(state({ isFetching: true }))).toBe("none")
  })

  it("does nothing once exhausted, or when there is no anchor to page from", () => {
    expect(profilePastEventsAction(state({ armed: true, isSuccess: true }))).toBe("none")
    expect(profilePastEventsAction(state({ anchor: null }))).toBe("none")
  })

  it("re-arms after the anchor moves under it (a profile refetch, or a different person)", () => {
    // The hook tracks WHICH anchor it armed for, so a moved cursor arrives here as armed: false.
    expect(profilePastEventsAction(state({ anchor: "cursor-2", armed: false }))).toBe("arm")
  })
})
