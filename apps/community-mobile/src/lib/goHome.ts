import type { Href } from "expo-router"

export const HOME_HREF = "/"

export interface HomeNavigator {
  dismissTo: (href: Href) => void
}

export type ShimNavPlan = { type: "home" } | { type: "replace"; href: Href }

export function shimNavPlan(to: Href | undefined): ShimNavPlan {
  if (to === undefined || to === HOME_HREF) return { type: "home" }
  return { type: "replace", href: to }
}

let teardownEpoch = 0

export function navTeardownEpoch(): number {
  return teardownEpoch
}

export function beginNavTeardown(): void {
  teardownEpoch += 1
}

export function goHome(router: HomeNavigator): void {
  beginNavTeardown()
  router.dismissTo(HOME_HREF)
}

/**
 * Home with the map showing, as the `/map` deep link lands. The shell's view
 * and open panel (Settings, say) are nav-store state on the root route, not
 * screens of their own, so dismissing to the root alone brings the shell back
 * as it was left. The store's "home" view is the feed, so this selects "map".
 */
export function goToMap(router: HomeNavigator, nav: { selectView: (view: "map") => void }): void {
  nav.selectView("map")
  goHome(router)
}
