import type { AuthStatus } from "@/lib/lifecycleTypes"

export const ONBOARDING_PAGE_COUNT = 5

export type OnboardingPage = "report" | "track" | "together" | "theme" | "ready"

export const ONBOARDING_PAGES: readonly OnboardingPage[] = [
  "report",
  "track",
  "together",
  "theme",
  "ready",
]

export const ONBOARDING_LAST_INDEX = ONBOARDING_PAGE_COUNT - 1

export interface OnboardingEligibility {
  completedVersion: number
  currentVersion: number
  replayRequested: boolean
  gateActive: boolean
  authStatus: AuthStatus
  profileIncomplete: boolean
}

export function shouldShowOnboarding(input: OnboardingEligibility): boolean {
  if (input.gateActive) return false
  if (input.authStatus !== "authed" && input.authStatus !== "unauthed") return false
  if (input.profileIncomplete) return false
  if (input.replayRequested) return true
  return input.completedVersion < input.currentVersion
}

export type OnboardingEnterPlan = "instant" | "fade"

export interface OnboardingEnterInput {
  loadingGateMounted: boolean
  reduceMotion: boolean
}

export function onboardingEnterPlan({
  loadingGateMounted,
  reduceMotion,
}: OnboardingEnterInput): OnboardingEnterPlan {
  if (loadingGateMounted) return "instant"
  return reduceMotion ? "instant" : "fade"
}

export function clampPageIndex(index: number): number {
  if (!Number.isFinite(index)) return 0
  return Math.min(ONBOARDING_LAST_INDEX, Math.max(0, Math.round(index)))
}

export function pageIndexForOffset(offsetX: number, pageWidth: number): number {
  if (!Number.isFinite(offsetX) || !Number.isFinite(pageWidth) || pageWidth <= 0) return 0
  return clampPageIndex(offsetX / pageWidth)
}

export function railSegmentState(index: number, current: number): "done" | "active" | "todo" {
  if (index < current) return "done"
  if (index === current) return "active"
  return "todo"
}

export function skipVisible(index: number): boolean {
  return clampPageIndex(index) < ONBOARDING_LAST_INDEX
}

export type OnboardingBackPlan = { type: "previous"; to: number } | { type: "swallow" }

export function onboardingBackPlan(current: number): OnboardingBackPlan {
  const clamped = clampPageIndex(current)
  if (clamped <= 0) return { type: "swallow" }
  return { type: "previous", to: clamped - 1 }
}

const SATURDAY = 6
const DAYS_PER_WEEK = 7
const DEMO_EVENT_HOUR = 9
const MINUTE_MS = 60_000

/** The tour's demo event is always the coming Saturday morning, so its card never reads as past. */
export function demoEventAt(now: Date): string {
  const at = new Date(now.getTime())
  at.setHours(DEMO_EVENT_HOUR, 0, 0, 0)
  at.setDate(at.getDate() + ((SATURDAY - at.getDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK))
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + DAYS_PER_WEEK)
  return at.toISOString()
}

export function demoChatAt(now: Date): readonly [string, string] {
  return [
    new Date(now.getTime() - 6 * MINUTE_MS).toISOString(),
    new Date(now.getTime() - 3 * MINUTE_MS).toISOString(),
  ]
}
