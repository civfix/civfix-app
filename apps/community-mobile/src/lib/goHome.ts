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
