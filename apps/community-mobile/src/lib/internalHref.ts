import type { NativeRoute } from "./navBridge"

export const SHELL_HOST_ROUTE_NAMES: readonly string[] = [
  "index",
  "cleanups/[id]",
  "cleanups/[id]/analytics",
  "cleanups/[id]/announcements",
  "cleanups/[id]/announcements/[announcementId]",
  "cleanups/[id]/checkin",
  "cleanups/[id]/host",
  "cleanups/[id]/hours",
  "cleanups/[id]/team",
  "cleanups/[id]/ticket",
  "cleanups/[id]/ticket/[seatId]",
  "dashboard",
  "orgs/[slug]",
  "orgs/[slug]/manage",
  "people/[id]",
  "pin/[id]",
  "profile",
]

export function normalizeRouteName(name: string): string {
  return name.length > "index".length && name.endsWith("/index")
    ? name.slice(0, -"/index".length)
    : name
}

export function shellHostsEntries(route: NativeRoute | null | undefined): boolean {
  return !!route?.name && SHELL_HOST_ROUTE_NAMES.includes(normalizeRouteName(route.name))
}

export type InternalHrefAction =
  | "none"
  | "navigate"
  | "navigate-and-dismiss"
  | "push-route"

export interface InternalHrefInput {
  entryKey: string | null
  activeKey: string | null
  bridged: boolean
  bridgeFocused: boolean
  shellFocused: boolean
  routeFocused: boolean
  detailRoute: boolean
}

export function internalHrefAction(input: InternalHrefInput): InternalHrefAction {
  if (input.bridgeFocused) return "none"
  if (input.bridged) return "navigate"
  if (input.shellFocused) {
    return input.entryKey !== null && input.entryKey === input.activeKey ? "none" : "navigate"
  }
  return input.routeFocused && input.detailRoute ? "push-route" : "navigate-and-dismiss"
}
