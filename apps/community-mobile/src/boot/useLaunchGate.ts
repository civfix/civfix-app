import { useEffect, useState } from "react"
import * as SplashScreen from "expo-splash-screen"
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import type { BootGateState } from "@/boot/bootGateModel"
import type { AuthStatus } from "@/lib/lifecycleTypes"
import { useBootGate } from "@/hooks/useBootGate"
import { useOnboardingStore } from "@/store/onboardingStore"

const SPLASH_WATCHDOG_MS = 5000
const MIN_SPLASH_MS = 1700
const GATE_FADE_MS = 450

export interface FontLoadState {
  loaded: boolean
  error: Error | null
}

export interface LaunchGate {
  fontsReady: boolean
  gateActive: boolean
  gateMounted: boolean
  gateStyle: ReturnType<typeof useAnimatedStyle>
  boot: BootGateState
}

export function useLaunchGate({ loaded, error }: FontLoadState, status: AuthStatus): LaunchGate {
  const [fontWaitElapsed, setFontWaitElapsed] = useState(false)
  useEffect(() => {
    if (loaded || error) return
    const watchdog = setTimeout(() => setFontWaitElapsed(true), SPLASH_WATCHDOG_MS)
    return () => clearTimeout(watchdog)
  }, [loaded, error])

  const fontsReady = loaded || error != null || fontWaitElapsed

  useEffect(() => {
    if (!fontsReady) return
    void SplashScreen.hideAsync().catch(() => undefined)
  }, [fontsReady])

  const [minSplashElapsed, setMinSplashElapsed] = useState(false)
  useEffect(() => {
    if (!fontsReady) return
    const t = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_MS)
    return () => clearTimeout(t)
  }, [fontsReady])

  const boot = useBootGate()

  const gateActive =
    !fontsReady ||
    boot.phase === "connecting" ||
    boot.phase === "offline" ||
    (status === "authed" && !minSplashElapsed)

  const setGateActive = useOnboardingStore((s) => s.setGateActive)
  useEffect(() => {
    setGateActive(gateActive)
  }, [gateActive, setGateActive])

  const [gateMounted, setGateMounted] = useState(gateActive)
  const gateOpacity = useSharedValue(1)
  const gateStyle = useAnimatedStyle(() => ({ opacity: gateOpacity.value }))

  useEffect(() => {
    if (gateActive) {
      gateOpacity.value = 1
      setGateMounted(true)
      return
    }
    gateOpacity.value = withTiming(0, { duration: GATE_FADE_MS })
    const unmount = setTimeout(() => setGateMounted(false), GATE_FADE_MS)
    return () => clearTimeout(unmount)
  }, [gateActive, gateOpacity])

  return { fontsReady, gateActive, gateMounted, gateStyle, boot }
}
