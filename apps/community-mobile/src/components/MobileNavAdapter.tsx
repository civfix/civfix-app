import { useEffect } from "react"
import { useNavigationContainerRef, useRouter } from "expo-router"
import { useNavStore, entryFromPath, entryIdentity, isRootLink, type DetailEntry } from "@civfix/ui"
import { toInternalHref } from "@/lib/links"
import { internalHrefAction, shellHostsEntries } from "@/lib/internalHref"
import { threadEntryRoute } from "@/lib/threadEntryRoutes"
import {
  INITIAL_BRIDGE_GUARD,
  bridgeDecision,
  bridgeKey,
  nativeBridgeKey,
  stackWithoutBridged,
  type BridgeGuard,
  type NativeRoute,
  type NativeRouteTarget,
} from "@/lib/navBridge"

export function seedEntry(entry: DetailEntry): void {
  useNavStore.getState().seed(entry, "compact")
}

export interface InternalHrefResult {
  entry: DetailEntry
  dismissToShell: boolean
}

let bridgeGuard: BridgeGuard = INITIAL_BRIDGE_GUARD
let readFocusedRoute: () => NativeRoute | null = () => null
let pushDetailRoute: ((route: NativeRouteTarget) => void) | null = null

export function applyInternalHref(href: string): InternalHrefResult | null {
  if (!toInternalHref(href)) return null
  const entry = entryFromPath(href)
  if (!entry) {
    if (isRootLink(href)) useNavStore.getState().selectView("home")
    return null
  }
  const key = bridgeKey(entry)
  const focused = readFocusedRoute()
  const detailRoute = threadEntryRoute(entry)
  const action = internalHrefAction({
    entryKey: entryIdentity(entry),
    activeKey: entryIdentity(useNavStore.getState().active),
    bridged: key !== null,
    bridgeFocused: key !== null && key === nativeBridgeKey(focused),
    shellFocused: shellHostsEntries(focused),
    routeFocused: focused !== null && pushDetailRoute !== null,
    detailRoute: detailRoute !== null,
  })
  if (action === "push-route" && detailRoute !== null && pushDetailRoute !== null) {
    pushDetailRoute(detailRoute)
    return { entry, dismissToShell: false }
  }
  if (action !== "none") useNavStore.getState().navigateTo(entry, "compact")
  return { entry, dismissToShell: action === "navigate-and-dismiss" }
}

export function useMobileNavAdapter(): void {
  const router = useRouter()
  const navigationRef = useNavigationContainerRef()

  useEffect(() => {
    const focusedRoute = (): NativeRoute | null =>
      navigationRef.isReady() ? (navigationRef.getCurrentRoute() ?? null) : null
    const focusedKey = (): string | null => nativeBridgeKey(focusedRoute())
    readFocusedRoute = focusedRoute
    pushDetailRoute = (route) =>
      router.push({ pathname: route.pathname as never, params: route.params })

    const decide = (active: DetailEntry | null): void => {
      const decision = bridgeDecision(active, bridgeGuard, Date.now(), focusedKey())
      bridgeGuard = decision.guard
      if (decision.action.type === "none") return
      const route = decision.action.type === "bridge" ? decision.action.route : null
      const stack = stackWithoutBridged(useNavStore.getState().stack, decision.action.key)
      if (!stack) return
      useNavStore.getState().setStack(stack)
      if (route) router.push(route)
    }

    decide(useNavStore.getState().active)
    const unsubscribe = useNavStore.subscribe((state) => decide(state.active))
    return () => {
      readFocusedRoute = () => null
      pushDetailRoute = null
      unsubscribe()
    }
  }, [router, navigationRef])
}
