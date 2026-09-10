import type { DetailEntry } from "@civfix/ui"

export const BRIDGE_REPEAT_WINDOW_MS = 300

export const BRIDGE_ROUTE_NAMES = {
  thread: "messages/[id]",
  postThread: "post/[id]",
  composer: "compose",
  hostMode: "cleanups/[id]/host",
  hostCheckin: "cleanups/[id]/checkin",
  hostTeam: "cleanups/[id]/team",
  myTicket: "cleanups/[id]/ticket",
  myTicketSeat: "cleanups/[id]/ticket/[seatId]",
  org: "orgs/[slug]",
} as const

export const MY_TICKET_ROUTE_NAMES: readonly string[] = [
  BRIDGE_ROUTE_NAMES.myTicket,
  `${BRIDGE_ROUTE_NAMES.myTicket}/index`,
  BRIDGE_ROUTE_NAMES.myTicketSeat,
]

export const SHELL_HOSTED_BRIDGE_KINDS: readonly string[] = [
  "host-mode",
  "host-checkin",
  "host-team",
  "my-ticket",
  "org",
]

export function stackWithoutShellHosted(stack: readonly DetailEntry[]): DetailEntry[] {
  return stack.filter((entry) => !SHELL_HOSTED_BRIDGE_KINDS.includes(entry.kind))
}

export interface BridgeRoute {
  pathname: string
  params: Record<string, string>
}

export interface NativeRoute {
  name?: string
  params?: object
}

export interface BridgeGuard {
  openKey: string | null
  recentKey: string | null
  recentAt: number
}

export type BridgeAction =
  | { type: "none" }
  | { type: "drop"; key: string }
  | { type: "bridge"; key: string; route: BridgeRoute }

export interface BridgeDecision {
  action: BridgeAction
  guard: BridgeGuard
}

export const INITIAL_BRIDGE_GUARD: BridgeGuard = { openKey: null, recentKey: null, recentAt: 0 }

export function bridgeKey(entry: DetailEntry | null | undefined): string | null {
  if (!entry) return null
  if (entry.kind === "composer") {
    return `composer:${entry.composerMode ?? "post"}:${entry.targetPostId ?? ""}`
  }
  if (entry.kind === "post-thread") return entry.id ? `post-thread:${entry.id}` : null
  if (entry.kind === "thread") return entry.id ? `thread:${entry.id}` : null
  if (entry.kind === "host-mode") return entry.id ? `host-mode:${entry.id}` : null
  if (entry.kind === "host-checkin") return entry.id ? `host-checkin:${entry.id}` : null
  if (entry.kind === "host-team") return entry.id ? `host-team:${entry.id}` : null
  if (entry.kind === "my-ticket") return entry.id ? `my-ticket:${entry.id}:${entry.seatId ?? ""}` : null
  if (entry.kind === "org") return entry.slug ? `org:${entry.slug}` : null
  return null
}

function routeParam(params: object | undefined, key: string): string {
  if (!params) return ""
  const value = (params as Record<string, unknown>)[key]
  return typeof value === "string" ? value : ""
}

export function nativeBridgeKey(route: NativeRoute | null | undefined): string | null {
  if (!route?.name) return null
  if (route.name === BRIDGE_ROUTE_NAMES.thread) {
    const id = routeParam(route.params, "id")
    return id ? `thread:${id}` : null
  }
  if (route.name === BRIDGE_ROUTE_NAMES.postThread) {
    const id = routeParam(route.params, "id")
    return id ? `post-thread:${id}` : null
  }
  if (route.name === BRIDGE_ROUTE_NAMES.composer) {
    return `composer:${routeParam(route.params, "mode") || "post"}:${routeParam(route.params, "targetPostId")}`
  }
  if (route.name === BRIDGE_ROUTE_NAMES.hostMode) {
    const id = routeParam(route.params, "id")
    return id ? `host-mode:${id}` : null
  }
  if (route.name === BRIDGE_ROUTE_NAMES.hostCheckin) {
    const id = routeParam(route.params, "id")
    return id ? `host-checkin:${id}` : null
  }
  if (route.name === BRIDGE_ROUTE_NAMES.hostTeam) {
    const id = routeParam(route.params, "id")
    return id ? `host-team:${id}` : null
  }
  if (MY_TICKET_ROUTE_NAMES.includes(route.name)) {
    const id = routeParam(route.params, "id")
    return id ? `my-ticket:${id}:${routeParam(route.params, "seatId")}` : null
  }
  if (route.name === BRIDGE_ROUTE_NAMES.org) {
    const slug = routeParam(route.params, "slug")
    return slug ? `org:${slug}` : null
  }
  return null
}

export function bridgeRoute(entry: DetailEntry): BridgeRoute | null {
  if (entry.kind === "composer") {
    return {
      pathname: `/${BRIDGE_ROUTE_NAMES.composer}`,
      params: {
        mode: entry.composerMode ?? "post",
        ...(entry.targetPostId ? { targetPostId: entry.targetPostId } : {}),
      },
    }
  }
  if (entry.kind === "post-thread") {
    return entry.id ? { pathname: `/${BRIDGE_ROUTE_NAMES.postThread}`, params: { id: entry.id } } : null
  }
  if (entry.kind === "host-mode") {
    return entry.id ? { pathname: `/${BRIDGE_ROUTE_NAMES.hostMode}`, params: { id: entry.id } } : null
  }
  if (entry.kind === "host-checkin") {
    return entry.id ? { pathname: `/${BRIDGE_ROUTE_NAMES.hostCheckin}`, params: { id: entry.id } } : null
  }
  if (entry.kind === "host-team") {
    return entry.id ? { pathname: `/${BRIDGE_ROUTE_NAMES.hostTeam}`, params: { id: entry.id } } : null
  }
  if (entry.kind === "my-ticket") {
    if (!entry.id) return null
    return entry.seatId
      ? {
          pathname: `/${BRIDGE_ROUTE_NAMES.myTicketSeat}`,
          params: { id: entry.id, seatId: entry.seatId },
        }
      : { pathname: `/${BRIDGE_ROUTE_NAMES.myTicket}`, params: { id: entry.id } }
  }
  if (entry.kind === "org") {
    return entry.slug ? { pathname: `/${BRIDGE_ROUTE_NAMES.org}`, params: { slug: entry.slug } } : null
  }
  if (entry.kind === "thread") {
    if (!entry.id) return null
    const peer = entry.peer
    return {
      pathname: `/${BRIDGE_ROUTE_NAMES.thread}`,
      params: {
        id: entry.id,
        roomKind: entry.roomKind ?? "cleanup",
        ...(peer?.id ? { peerId: peer.id } : {}),
        ...(peer?.name ? { peerName: peer.name } : {}),
        ...(peer?.handle ? { peerHandle: peer.handle } : {}),
      },
    }
  }
  return null
}

export function bridgeDecision(
  active: DetailEntry | null,
  guard: BridgeGuard,
  now: number,
  focusedKey: string | null = null,
): BridgeDecision {
  const key = bridgeKey(active)
  if (!active || !key) {
    return {
      action: { type: "none" },
      guard: guard.openKey === null ? guard : { ...guard, openKey: null },
    }
  }
  if (key === guard.openKey) return { action: { type: "none" }, guard }
  if (key === focusedKey) {
    const guarded = { ...guard, openKey: key }
    if (SHELL_HOSTED_BRIDGE_KINDS.includes(active.kind)) {
      return { action: { type: "none" }, guard: guarded }
    }
    return { action: { type: "drop", key }, guard: guarded }
  }
  if (key === guard.recentKey && now - guard.recentAt < BRIDGE_REPEAT_WINDOW_MS) {
    return { action: { type: "drop", key }, guard: { ...guard, openKey: key } }
  }
  const route = bridgeRoute(active)
  if (!route) return { action: { type: "none" }, guard }
  return {
    action: { type: "bridge", key, route },
    guard: { openKey: key, recentKey: key, recentAt: now },
  }
}

export function stackWithoutBridged(
  stack: DetailEntry[],
  key: string,
): DetailEntry[] | null {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (bridgeKey(stack[i]) === key) return [...stack.slice(0, i), ...stack.slice(i + 1)]
  }
  return null
}

export interface DetailRestoreInput {
  restore: readonly DetailEntry[]
  seedKey: string | null
  activeKey: string | null
  stackLength: number
  left: boolean
  tornDown: boolean
  focusedBridgeKey: string | null
}

export type DetailRestoreSkipReason = "torn-down" | "removed" | "not-ours" | "noop"

export type DetailRestorePlan =
  | { type: "skip"; reason: DetailRestoreSkipReason }
  | { type: "restore"; stack: DetailEntry[] }

export function restorableStack(
  stack: readonly DetailEntry[],
  focusedBridgeKey: string | null,
): DetailEntry[] {
  return stack.filter((entry) => {
    const key = bridgeKey(entry)
    return key === null || key === focusedBridgeKey
  })
}

export function detailRestorePlan(input: DetailRestoreInput): DetailRestorePlan {
  if (input.tornDown) return { type: "skip", reason: "torn-down" }
  if (input.activeKey === null) {
    if (!input.left) return { type: "skip", reason: "removed" }
  } else if (input.activeKey !== input.seedKey) {
    return { type: "skip", reason: "not-ours" }
  }
  const stack = restorableStack(input.restore, input.focusedBridgeKey)
  if (stack.length === 0 && input.stackLength === 0) return { type: "skip", reason: "noop" }
  return { type: "restore", stack }
}
