import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Appearance,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native"
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import * as SystemUI from "expo-system-ui"
import * as NavigationBar from "expo-navigation-bar"
import * as Notifications from "expo-notifications"
import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import {
  CapabilitiesProvider,
  makeFakeCapabilities,
  type PlatformCapabilities,
} from "@civfix/ui/capabilities"
import {
  ApiProvider,
  normalizeAuthState,
  type AuthState,
  type DataContextValue,
} from "@civfix/ui/data"
import {
  ThemeProvider,
  setAppearancePreferenceStore,
  supportsBlur,
  useColorSchemeName,
  useTheme,
  type ColorSchemeName,
  type Theme,
} from "@civfix/ui/theme"
import { I18nProvider, createI18n } from "@civfix/ui/i18n"
import {
  MediaLightboxProvider,
  SharePostProvider,
  ToastProvider,
  setBrandAboutPresenter,
  setOnboardingTourPresenter,
  setScanPresenter,
  setWebOrigin,
} from "@civfix/ui"
import { CARTO_API_KEY, DONATE_BROWSER_MODE, WEB_ORIGIN } from "@/config"
import { nativeCamera, setCameraNavigator } from "@/lib/nativeCamera"
import { nativeCalendarFile } from "@/lib/nativeCalendarFile"
import { nativeClipboard } from "@/lib/nativeClipboard"
import { nativeGeolocation } from "@/lib/nativeGeolocation"
import { nativeHaptics } from "@/lib/nativeHaptics"
import { nativePush } from "@/lib/nativePush"
import { nativeSecureStore } from "@/lib/nativeSecureStore"
import { getAppearancePreference, resolveColorScheme, themeFor } from "@/theme"
import { LAUNCH_SCHEME, launchTheme } from "@/boot/launchTheme"
import { useAppFonts } from "@/theme/fonts"
import { QueryProvider } from "@/query/QueryProvider"
import { queryClient } from "@/query/client"
import { purgeQueryCache } from "@/query/mmkv-persister"
import { api, setUnauthorizedHandler } from "@/api/client"
import { useAuthStore } from "@/store/authStore"
import { chatSocket } from "@/lib/ws"
import { usePrefsStore } from "@/store/prefsStore"
import { resolveActiveLocale } from "@/lib/locale"
import { goHome } from "@/lib/goHome"
import { isExternalUrl } from "@/lib/links"
import { codeScannerSupported } from "@/lib/scannerSupport"
import {
  freshPushAttemptState,
  isForegroundEdge,
  isPushOutcomeTerminal,
  shouldAttemptPushRegistration,
  type PushAttemptState,
} from "@/lib/pushRegistrationRetry"
import { useAuthGate } from "@/hooks/useAuthGate"
import { useBootGate } from "@/hooks/useBootGate"
import { useAppLifecycle } from "@/hooks/useAppLifecycle"
import { useSignOutReset } from "@/hooks/useSignOutReset"
import { AuthGate } from "@/components/AuthGate"
import { BootOfflineGate } from "@/components/BootConnectivity"
import { FirstRunGate } from "@/components/FirstRunGate"
import { OnboardingGate } from "@/components/onboarding/OnboardingGate"
import { useOnboardingStore } from "@/store/onboardingStore"
import { useAppearanceStore } from "@/store/appearanceStore"
import {
  ensureNotificationCategories,
  registerForPushNotifications,
  linkFromNotificationResponse,
} from "@/push/register"
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel"
import { applyInternalHref, useMobileNavAdapter } from "@/components/MobileNavAdapter"

export const unstable_settings = { anchor: "index" }

setAppearancePreferenceStore({
  get: () => useAppearanceStore.getState().preference,
  set: (p) => useAppearanceStore.getState().setPreference(p),
  subscribe: (l) => useAppearanceStore.subscribe(l),
})

void SplashScreen.preventAutoHideAsync()
void SystemUI.setBackgroundColorAsync(launchTheme.colors.bg)

const SPLASH_WATCHDOG_MS = 5000
const MIN_SPLASH_MS = 1700
const GATE_FADE_MS = 450

function currentTheme(): Theme {
  return themeFor(resolveColorScheme(getAppearancePreference(), Appearance.getColorScheme()))
}

function useAppearanceScheme(): ColorSchemeName {
  const preference = useAppearanceStore((s) => s.preference)
  const system = useColorScheme()
  return resolveColorScheme(preference, system)
}

function useAppearanceTheme(): Theme {
  const scheme = useAppearanceScheme()
  const theme = useMemo(() => themeFor(scheme), [scheme])

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.bg)
  }, [theme.colors.bg])

  return theme
}

function BootBackdrop() {
  return (
    <>
      <StatusBar style={launchTheme.scheme === "dark" ? "light" : "dark"} />
      <View style={styles.gate} />
    </>
  )
}

let inAppBrowserOpen = false

async function openInAppBrowser(url: string): Promise<void> {
  if (!isExternalUrl(url)) {
    console.warn("[links] refused an in-app browser target that is not an https URL")
    return
  }
  if (DONATE_BROWSER_MODE === "system") {
    await Linking.openURL(url)
    return
  }
  if (inAppBrowserOpen) return
  const t = currentTheme()
  inAppBrowserOpen = true
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      dismissButtonStyle: "close",
      toolbarColor: t.colors.bg,
      controlsColor: t.colors.accentText,
      secondaryToolbarColor: t.colors.bgAlt,
      enableBarCollapsing: false,
      showTitle: true,
    })
  } catch (err) {
    console.warn("[links] the in-app browser was unavailable; opening the system browser", err)
    await Linking.openURL(url)
  } finally {
    inAppBrowserOpen = false
  }
}

setWebOrigin(WEB_ORIGIN)

const mobileCapabilities: PlatformCapabilities = {
  ...makeFakeCapabilities(),
  camera: nativeCamera,
  geolocation: nativeGeolocation,
  push: nativePush,
  secureStore: nativeSecureStore,
  blurSurface: { supported: supportsBlur },
  haptics: nativeHaptics,
  clipboard: nativeClipboard,
  ...(nativeCalendarFile ? { calendarFile: nativeCalendarFile } : {}),
  openExternal: {
    open: async (url: string): Promise<void> => {
      if (!isExternalUrl(url)) {
        console.warn("[links] refused an external target that is not an https URL")
        return
      }
      await Linking.openURL(url)
    },
    openInAppBrowser,
  },
  openInternalHref: {
    open: (path: string): boolean => {
      const applied = applyInternalHref(path)
      if (!applied) return false
      if (applied.dismissToShell) dismissToShell?.()
      return true
    },
  },
}

let dismissToShell: (() => void) | null = null

function InternalHrefBridge(): null {
  const router = useRouter()
  useEffect(() => {
    dismissToShell = () => goHome(router)
    return () => {
      dismissToShell = null
    }
  }, [router])
  return null
}

function CameraNavigatorBridge(): null {
  const router = useRouter()
  useEffect(() => {
    setCameraNavigator((captureId) => router.push({ pathname: "/report/camera", params: { captureId } }))
    return () => setCameraNavigator(null)
  }, [router])
  return null
}

function ScanPresenterBridge(): null {
  const router = useRouter()
  useEffect(() => {
    if (!codeScannerSupported(Platform.OS)) return
    setScanPresenter((session) => router.push({ pathname: "/scan", params: { session } }))
    return () => setScanPresenter(null)
  }, [router])
  return null
}

function BrandAboutBridge(): null {
  const router = useRouter()
  useEffect(() => {
    setBrandAboutPresenter(() => router.push("/about"))
    return () => setBrandAboutPresenter(null)
  }, [router])
  return null
}

function OnboardingTourBridge(): null {
  useEffect(() => {
    setOnboardingTourPresenter(() => useOnboardingStore.getState().replay())
    return () => setOnboardingTourPresenter(null)
  }, [])
  return null
}

function NavAdapterBridge(): null {
  useMobileNavAdapter()
  return null
}

function useMobileAuthState(): AuthState {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const guestSmsEnabled = useAuthStore((s) => s.guestSmsEnabled)
  return normalizeAuthState({
    authed: status === "authed",
    pending: status === "idle" || status === "loading",
    user,
    guestSmsEnabled,
  })
}

function MobileDataProvider({ children }: { children: React.ReactNode }) {
  const { requireAuth: gateRequireAuth } = useAuthGate()
  const signOut = useAuthStore((s) => s.signOut)

  const requireAuth = useCallback(
    (action: () => void, opts?: { next?: string }) => {
      gateRequireAuth(opts?.next ?? "/", action)
    },
    [gateRequireAuth],
  )

  const value = useMemo<DataContextValue>(
    () => ({
      api,
      useAuthState: useMobileAuthState,
      requireAuth,
      logout: signOut,
      chatSocket,
      ...(CARTO_API_KEY ? { cartoApiKey: CARTO_API_KEY } : {}),
      onUserUpdated: (user) => useAuthStore.getState().setUser(user),
    }),
    [requireAuth, signOut],
  )

  return <ApiProvider value={value}>{children}</ApiProvider>
}

function MobileI18nProvider({ children }: { children: React.ReactNode }) {
  const userLocale = useAuthStore((s) => s.user?.locale ?? null)
  const setLocale = usePrefsStore((s) => s.setLocale)
  const setInitialLocale = usePrefsStore((s) => s.setInitialLocale)
  const storeLocale = usePrefsStore((s) => s.locale)

  const resolved = useMemo(
    () => resolveActiveLocale(userLocale ? { locale: userLocale } : null),
    [userLocale],
  )
  useEffect(() => {
    setInitialLocale(resolved)
  }, [resolved, setInitialLocale])

  return (
    <I18nProvider locale={storeLocale} setLocale={setLocale}>
      {children}
    </I18nProvider>
  )
}

function useBootstrap() {
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      useAuthStore.getState().markUnauthed()
    })
    void hydrate()
    return () => setUnauthorizedHandler(null)
  }, [hydrate])
}

function useAuthRedirect() {
  const router = useRouter()
  const segments = useSegments()
  const status = useAuthStore((s) => s.status)

  useEffect(() => {
    if (status === "idle" || status === "loading") return
    if (status === "authed" && segments[0] === "auth") {
      goHome(router)
    }
  }, [status, segments, router])
}

function usePushOnSignIn() {
  const status = useAuthStore((s) => s.status)
  const attemptRef = useRef<PushAttemptState>(freshPushAttemptState())

  useEffect(() => {
    if (status !== "authed") {
      if (status === "unauthed") attemptRef.current = freshPushAttemptState()
      return
    }

    const attempt = (): void => {
      const state = attemptRef.current
      if (!shouldAttemptPushRegistration(state)) return
      state.attempts += 1
      state.inFlight = true

      void (async () => {
        try {
          const prefs = await api.getNotificationPrefs()
          if (!prefs.push) {
            state.settled = true
            return
          }
          const result = await registerForPushNotifications()
          if (isPushOutcomeTerminal(result.status)) {
            state.settled = true
            return
          }
          console.warn(
            `[push] registration not completed: ${result.status}`,
            "reason" in result ? result.reason : "",
          )
        } catch (err) {
          console.warn("[push] notification prefs unreachable; retrying on next foreground", err)
        } finally {
          state.inFlight = false
        }
      })()
    }

    attempt()
    const subscription = AppState.addEventListener("change", (next) => {
      if (isForegroundEdge(attemptRef.current, next)) attempt()
    })
    return () => subscription.remove()
  }, [status])
}

function useNotificationDeepLinks() {
  const handledResponseIdRef = useRef<string | null>(null)
  const locale = usePrefsStore((state) => state.locale)

  useEffect(() => {
    void ensureNotificationCategories()
  }, [locale])

  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse | null | undefined) => {
      const id = response?.notification?.request?.identifier
      if (!id || handledResponseIdRef.current === id) return
      const href = linkFromNotificationResponse(response)
      if (!href) return
      handledResponseIdRef.current = id
      setTimeout(() => {
        const applied = applyInternalHref(href as string)
        if (applied?.dismissToShell) dismissToShell?.()
      }, 0)
    }

    const sub = Notifications.addNotificationResponseReceivedListener(handle)

    try {
      handle(Notifications.getLastNotificationResponse())
      Notifications.clearLastNotificationResponse()
    } catch {
    }

    return () => sub.remove()
  }, [])
}

function RealtimeChannel(): null {
  useRealtimeChannel()
  return null
}

function RootStack({ launchGate }: { launchGate: boolean }) {
  const liveScheme = useColorSchemeName()
  const scheme = launchGate ? LAUNCH_SCHEME : liveScheme
  const t = useTheme()

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(t.colors.bg)
  }, [t.colors.bg])

  useEffect(() => {
    if (Platform.OS !== "android") return
    void NavigationBar.setButtonStyleAsync(scheme === "dark" ? "light" : "dark")
  }, [scheme])

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.colors.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ animation: "fade" }} />
        <Stack.Screen name="messages/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen
          name="groups/[id]/info"
          options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="messages/members/[roomKind]/[id]"
          options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="about"
          options={{
            presentation: "transparentModal",
            animation: "fade",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  const { loaded, error } = useAppFonts()
  const status = useAuthStore((s) => s.status)

  useBootstrap()
  useAppLifecycle()
  useSignOutReset()
  useAuthRedirect()
  usePushOnSignIn()
  useNotificationDeepLinks()

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

  if (!fontsReady) {
    return <BootBackdrop />
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
      <SafeAreaProvider>
        <QueryProvider>
          <MobileDataProvider>
            <CapabilitiesProvider value={mobileCapabilities}>
              <RealtimeChannel />
              <CameraNavigatorBridge />
              <ScanPresenterBridge />
              <BrandAboutBridge />
              <OnboardingTourBridge />
              <NavAdapterBridge />
              <InternalHrefBridge />
            <MobileI18nProvider>
            <ToastProvider>
            <MediaLightboxProvider>
            <SharePostProvider>
            <BottomSheetModalProvider>
              <RootStack launchGate={gateMounted} />
              <OnboardingGate gateActive={gateActive} loadingGateMounted={gateMounted} />
              <FirstRunGate />
              {gateMounted ? (
                <Animated.View
                  pointerEvents={gateActive ? "auto" : "none"}
                  style={[StyleSheet.absoluteFill, styles.loadingGate, gateStyle]}
                >
                  {boot.phase === "offline" ? <BootOfflineGate /> : <AuthGate mode="loading" />}
                </Animated.View>
              ) : null}
            </BottomSheetModalProvider>
            </SharePostProvider>
            </MediaLightboxProvider>
            </ToastProvider>
            </MobileI18nProvider>
            </CapabilitiesProvider>
          </MobileDataProvider>
        </QueryProvider>
      </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}

const CRASH_COPY = {
  title: "Something went wrong",
  body: "civfix hit an unexpected problem. Try again - your reports and messages are safe.",
  action: "Try again",
}

function crashCopy(): typeof CRASH_COPY {
  try {
    const t = createI18n(resolveActiveLocale(null)).getFixedT(null, "mobile-system")
    return {
      title: t("crash.title", { defaultValue: CRASH_COPY.title }),
      body: t("crash.body", { defaultValue: CRASH_COPY.body }),
      action: t("crash.action", { defaultValue: CRASH_COPY.action }),
    }
  } catch {
    return CRASH_COPY
  }
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const copy = useMemo(crashCopy, [])
  const theme = useAppearanceTheme()
  const crash = useMemo(() => crashStyles(theme), [theme])

  const onRetry = useCallback(() => {
    try {
      purgeQueryCache(queryClient)
    } catch (err) {
      console.warn("[crash] the cached query data could not be purged before retrying", err)
    }
    void retry()
  }, [retry])

  return (
    <View style={crash.root}>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      <Text style={crash.title}>{copy.title}</Text>
      <Text style={crash.body}>{copy.body}</Text>
      {__DEV__ ? <Text style={crash.detail}>{String(error?.message ?? error)}</Text> : null}
      <Pressable accessibilityRole="button" onPress={onRetry} style={crash.action}>
        <Text style={crash.actionLabel}>{copy.action}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gate: {
    flex: 1,
    backgroundColor: launchTheme.colors.bg,
  },
  loadingGate: {
    zIndex: 60,
    elevation: 60,
  },
})

function crashStyles(t: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.colors.bg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: t.space["6"],
    },
    title: {
      fontSize: t.fontSize["24"],
      fontWeight: "700",
      color: t.colors.text,
      textAlign: "center",
    },
    body: {
      marginTop: t.space["3"],
      fontSize: t.fontSize["16"],
      color: t.colors.textMuted,
      textAlign: "center",
    },
    detail: {
      marginTop: t.space["3"],
      fontSize: t.fontSize["13"],
      color: t.colors.textSubtle,
      textAlign: "center",
    },
    action: {
      marginTop: t.space["8"],
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      height: 52,
      paddingHorizontal: t.space["5"],
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.brand.bloom,
    },
    actionLabel: {
      fontSize: t.fontSize["16"],
      fontWeight: "600",
      color: t.colors.onAccent,
    },
  })
}
