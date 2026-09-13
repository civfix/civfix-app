import type { DetailEntry } from "@civfix/ui"

export const BRIDGE_REPEAT_WINDOW_MS = 300

export const BRIDGE_ROUTE_NAMES = {
  thread: "messages/[id]",
  postThread: "post/[id]",
  composer: "compose",
} as const

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
  if (key === focusedKey) return { action: { type: "drop", key }, guard: { ...guard, openKey: key } }
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
  | { type: "clear" }
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
  if (input.tornDown) {
    return input.activeKey !== null && input.activeKey === input.seedKey
      ? { type: "clear" }
      : { type: "skip", reason: "torn-down" }
  }
  if (input.activeKey === null) {
    if (!input.left) return { type: "skip", reason: "removed" }
  } else if (input.activeKey !== input.seedKey) {
    return { type: "skip", reason: "not-ours" }
  }
  const stack = restorableStack(input.restore, input.focusedBridgeKey)
  if (stack.length === 0 && input.stackLength === 0) return { type: "skip", reason: "noop" }
  return { type: "restore", stack }
}
