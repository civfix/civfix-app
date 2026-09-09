/**
 * The shared profile TAB BAR model - one control, both profiles (own `ProfileView` and other-person
 * `PersonDetailBody`).
 *
 * The default is POSTS on both, deliberately: a profile whose first screen is a segmented control
 * pointing at Events buries the thing people came to read, and having posts be section 1 of 1 (rather
 * than 4 of 4, under settings) is the structural half of the "ugly posts" fix.
 *
 * Availability FILTERS the fixed order; it never reorders it, so the tabs never dance between two
 * profiles. `posts` and `events` are always available (each owns its own empty copy), which is what
 * guarantees the default is reachable and a profile is never tab-less.
 */

export type ProfileTabId = "posts" | "events" | "hours" | "reports"

/** Fixed presentation order. Availability filters this list; it never reorders it. */
export const PROFILE_TAB_ORDER: readonly ProfileTabId[] = ["posts", "events", "hours", "reports"]
export const PROFILE_DEFAULT_TAB: ProfileTabId = "posts"

export interface ProfileTabDescriptor {
  id: ProfileTabId
  role: "tab"
  selected: boolean
}

export interface ProfileTabsModel {
  role: "tablist"
  tabs: ProfileTabDescriptor[]
  /** The tab that actually renders: `requested` when available, else the first available, else "posts". */
  active: ProfileTabId
}

export interface ProfileTabAvailability {
  posts: boolean
  events: boolean
  hours: boolean
  reports: boolean
}

/**
 * `requested` is the tab the caller wants - the user's last tap, or the `profileTab` carried on a nav
 * entry (the credited-hours receipt deep-links straight to `hours`). When it is not available the
 * model falls back to the FIRST available tab rather than blanking the body, and to `posts` if a
 * caller ever hands over an all-false availability.
 */
export function buildProfileTabsModel(
  requested: ProfileTabId,
  available: ProfileTabAvailability,
): ProfileTabsModel {
  const ids = PROFILE_TAB_ORDER.filter((id) => available[id])
  const active = ids.includes(requested) ? requested : (ids[0] ?? PROFILE_DEFAULT_TAB)
  return {
    role: "tablist",
    tabs: ids.map((id) => ({ id, role: "tab", selected: id === active })),
    active,
  }
}
