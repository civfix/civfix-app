import React, { useCallback, useEffect, useId, useLayoutEffect, useRef } from "react"
import { BackHandler } from "react-native"
import { Stack, useFocusEffect, useNavigationContainerRef, useRouter } from "expo-router"
import {
  AppShell,
  NestedShellHostProvider,
  defaultRenderBody,
  entryIdentity,
  useNavStore,
  type DetailEntry,
  type View as NavView,
} from "@civfix/ui"
import { seedEntry } from "@/components/MobileNavAdapter"
import { goHome, navTeardownEpoch } from "@/lib/goHome"
import { detailRestorePlan, nativeBridgeKey } from "@/lib/navBridge"
import {
  enterNestedShell,
  exitNestedShell,
  rootIsTopRoute,
  shellStackBelow,
  useNestedShellStore,
} from "@/lib/nestedShellSignal"
import { secondaryShellBackAction } from "@/lib/secondaryShellBack"

export interface DetailRouteHostProps {
  entry: DetailEntry | null
}

function renderSecondaryBody(entry: DetailEntry | null, view: NavView): React.ReactNode {
  return entry ? defaultRenderBody(entry, view) : null
}

export default function DetailRouteHost({ entry }: DetailRouteHostProps): React.JSX.Element {
  const router = useRouter()
  const navigationRef = useNavigationContainerRef()
  const hostId = useId()
  const ownedStack = useNestedShellStore((s) => shellStackBelow(s, hostId))
  const liveStackLength = useNavStore((s) => s.stack.length)
  const nativeGestureOwnsBack = (ownedStack ? ownedStack.length : liveStackLength) <= 1

  const entryRef = useRef(entry)
  entryRef.current = entry

  const seedKey = entryIdentity(entry)
  const seedKeyRef = useRef(seedKey)
  seedKeyRef.current = seedKey
  const restoreRef = useRef<DetailEntry[] | null>(null)
  const teardownEpochRef = useRef(navTeardownEpoch())
  const leftRef = useRef(false)

  const focusedBridgeKey = useCallback(
    () => (navigationRef.isReady() ? nativeBridgeKey(navigationRef.getCurrentRoute()) : null),
    [navigationRef],
  )
  const focusedBridgeKeyRef = useRef(focusedBridgeKey)
  focusedBridgeKeyRef.current = focusedBridgeKey

  useLayoutEffect(() => {
    if (restoreRef.current === null) {
      restoreRef.current = useNavStore
        .getState()
        .stack.filter((e) => entryIdentity(e) !== seedKey)
      teardownEpochRef.current = navTeardownEpoch()
    }
    enterNestedShell(hostId, restoreRef.current)
    if (entry) seedEntry(entry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey])

  useEffect(() => {
    return () => {
      const restore = restoreRef.current
      restoreRef.current = null
      if (restore === null) return
      const state = useNavStore.getState()
      const plan = detailRestorePlan({
        restore,
        seedKey: seedKeyRef.current,
        activeKey: entryIdentity(state.active),
        stackLength: state.stack.length,
        left: leftRef.current,
        tornDown: navTeardownEpoch() !== teardownEpochRef.current,
        focusedBridgeKey: focusedBridgeKeyRef.current(),
      })
      if (plan.type === "restore") state.setStack(plan.stack)
      else if (plan.type === "clear") state.setStack([])
    }
  }, [])

  useEffect(() => {
    return () => exitNestedShell(hostId)
  }, [hostId])

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!navigationRef.isReady()) return
        if (rootIsTopRoute(navigationRef.getCurrentRoute())) exitNestedShell(hostId)
      }
    }, [hostId, navigationRef]),
  )

  const leave = useCallback(() => {
    leftRef.current = true
    if (router.canGoBack()) router.back()
    else goHome(router)
  }, [router])

  const armedRef = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (useNavStore.getState().active === null && entryRef.current) seedEntry(entryRef.current)
      if (useNavStore.getState().active === null) {
        armedRef.current = false
        leave()
        return
      }
      armedRef.current = true
      return useNavStore.subscribe((state) => {
        if (state.active !== null) {
          armedRef.current = true
          return
        }
        if (!armedRef.current) return
        armedRef.current = false
        leave()
      })
    }, [leave]),
  )

  useFocusEffect(
    useCallback(() => {
      const onBackPress = (): boolean => {
        const action = secondaryShellBackAction(useNavStore.getState().stack.length, router.canGoBack())
        if (action !== "pop-detail") return false
        useNavStore.getState().back()
        return true
      }
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress)
      return () => subscription.remove()
    }, [router]),
  )

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: nativeGestureOwnsBack }} />
      <NestedShellHostProvider>
        <AppShell
          map={null}
          mapControls={null}
          authOverlay={null}
          renderBody={renderSecondaryBody}
          {...(ownedStack ? { stack: ownedStack } : {})}
        />
      </NestedShellHostProvider>
    </>
  )
}
