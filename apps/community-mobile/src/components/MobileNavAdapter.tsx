import { useEffect } from "react"
import { useNavigationContainerRef, useRouter } from "expo-router"
import { useNavStore, entryFromPath, isRootLink, type DetailEntry } from "@civfix/ui"
import { toInternalHref } from "@/lib/links"
import {
  INITIAL_BRIDGE_GUARD,
  bridgeDecision,
  bridgeKey,
  nativeBridgeKey,
  stackWithoutBridged,
  type BridgeGuard,
} from "@/lib/navBridge"

export function seedEntry(entry: DetailEntry): void {
  useNavStore.getState().seed(entry, "compact")
}

let bridgeGuard: BridgeGuard = INITIAL_BRIDGE_GUARD
let readFocusedBridgeKey: () => string | null = () => null

export function applyInternalHref(href: string): DetailEntry | null {
  if (!toInternalHref(href)) return null
  const entry = entryFromPath(href)
  if (!entry) {
    if (isRootLink(href)) useNavStore.getState().selectView("home")
    return null
  }
  const key = bridgeKey(entry)
  if (key !== null && key === readFocusedBridgeKey()) return entry
  useNavStore.getState().navigateTo(entry, "compact")
  return entry
}

export function useMobileNavAdapter(): void {
  const router = useRouter()
  const navigationRef = useNavigationContainerRef()

  useEffect(() => {
    const focusedKey = (): string | null =>
      navigationRef.isReady() ? nativeBridgeKey(navigationRef.getCurrentRoute()) : null
    readFocusedBridgeKey = focusedKey

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
      readFocusedBridgeKey = () => null
      unsubscribe()
    }
  }, [router, navigationRef])
}
