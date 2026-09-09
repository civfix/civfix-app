/**
 * The "Show more past events" controller's decisions, as pure functions over the query's observable
 * state - so they can be unit-tested in this package's node-environment vitest, which cannot render a
 * hook. `useProfilePastEvents` is the thin wiring around them.
 *
 * THE TRAP THIS EXISTS TO CLOSE: react-query's `hasNextPage` answers "is there a page AFTER the ones I
 * already hold", and it is `false` whenever the infinite query holds no pages at all. Deriving the
 * affordance from it directly therefore hid the control for the entire duration of the FIRST fetch (the
 * only fetch most viewers ever trigger), and - because the query is `retry: false` - hid it FOREVER once
 * that first fetch failed, stranding the rest of someone's civic history behind an inert error string.
 * "Exhausted" is a SUCCESSFUL page with no cursor after it, never the absence of pages.
 */

export interface ProfilePastEventsState {
  /** `UserProfileDTO.pastEventsCursor`: null when the inline first page was the whole history. */
  anchor: string | null
  /** The viewer has pressed the control at least once for THIS anchor. */
  armed: boolean
  isFetching: boolean
  isSuccess: boolean
  isError: boolean
  hasNextPage: boolean
}

export interface ProfilePastEventsView {
  canLoadMore: boolean
  isLoadingMore: boolean
  /** Render the control as a retry rather than as a fresh "load more". */
  isRetry: boolean
}

/** A successful page that reported no cursor after it - the only state that means "no more history". */
export function profilePastEventsExhausted(state: ProfilePastEventsState): boolean {
  return state.armed && state.isSuccess && !state.hasNextPage
}

export function profilePastEventsView(state: ProfilePastEventsState): ProfilePastEventsView {
  return {
    canLoadMore: state.anchor !== null && !profilePastEventsExhausted(state),
    isLoadingMore: state.armed && state.isFetching,
    isRetry: state.armed && state.isError && !state.isFetching,
  }
}

/**
 * What a press should do:
 *   "arm"   - nothing fetched yet; start at the anchor.
 *   "next"  - a page landed and reported a cursor; fetch the one after it. This is ALSO the retry for a
 *             failed next-page fetch, because `hasNextPage` still reflects the last SUCCESSFUL page, so
 *             re-running it retries exactly the page that failed instead of refetching the whole chain.
 *   "retry" - the arming fetch itself failed, so there is no page to continue from; refetch.
 *   "none"  - in flight, exhausted, or there is nothing to page.
 */
export type ProfilePastEventsAction = "arm" | "next" | "retry" | "none"

export function profilePastEventsAction(state: ProfilePastEventsState): ProfilePastEventsAction {
  if (state.isFetching || state.anchor === null) return "none"
  if (!state.armed) return "arm"
  if (state.hasNextPage) return "next"
  if (state.isError) return "retry"
  return "none"
}
