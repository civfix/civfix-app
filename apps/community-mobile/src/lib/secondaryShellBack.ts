import type { NavTransition } from "@civfix/ui"

export type SecondaryShellBackAction = "pop-detail" | "system"

export function secondaryShellBackAction(stackLength: number, canPopRoute: boolean): SecondaryShellBackAction {
  if (stackLength > 1) return "pop-detail"
  if (stackLength === 1 && !canPopRoute) return "pop-detail"
  return "system"
}

export type SecondaryShellLeaveAction = "back" | "home"

const VIEW_SWITCH_TRANSITIONS: ReadonlySet<NavTransition["type"]> = new Set(["select", "seed", "reset"])

export function secondaryShellLeaveAction(transition: NavTransition | null): SecondaryShellLeaveAction {
  return transition && VIEW_SWITCH_TRANSITIONS.has(transition.type) ? "home" : "back"
}
