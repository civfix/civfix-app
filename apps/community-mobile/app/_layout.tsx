import React, { useEffect } from "react"
import { StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import * as SystemUI from "expo-system-ui"
import * as Linking from "expo-linking"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet"
import Animated from "react-native-reanimated"
import {
  CapabilitiesProvider,
  makeFakeCapabilities,
  type PlatformCapabilities,
} from "@civfix/ui/capabilities"
import { ThemeProvider, setAppearancePreferenceStore, supportsBlur } from "@civfix/ui/theme"
import {
  MediaLightboxProvider,
  SharePostProvider,
  ToastProvider,
  setApiHost,
  setSourceCommit,
  setWebOrigin,
} from "@civfix/ui"
import { API_URL, SOURCE_COMMIT, WEB_ORIGIN } from "@/config"
import { nativeCamera } from "@/lib/nativeCamera"
import { nativeCalendarFile } from "@/lib/nativeCalendarFile"
import { nativeClipboard } from "@/lib/nativeClipboard"
import { nativeGeolocation } from "@/lib/nativeGeolocation"
import { nativeHaptics } from "@/lib/nativeHaptics"
import { nativePush } from "@/lib/nativePush"
import { nativeSecureStore } from "@/lib/nativeSecureStore"
import { launchTheme } from "@/boot/launchTheme"
import { AppBridges } from "@/boot/AppBridges"
import { BootBackdrop } from "@/boot/BootBackdrop"
import { openInAppBrowser } from "@/lib/inAppBrowser"
import { MobileDataProvider, MobileI18nProvider } from "@/boot/MobileProviders"
import { RootStack } from "@/boot/RootStack"
import { useAuthRedirect } from "@/boot/useAuthRedirect"
import { useBootstrap } from "@/boot/useBootstrap"
import { useLaunchGate } from "@/boot/useLaunchGate"
import { useAppFonts } from "@/theme/fonts"
import { QueryProvider } from "@/query/QueryProvider"
import { useAuthStore } from "@/store/authStore"
import { goHome } from "@/lib/goHome"
import { isExternalUrl } from "@/lib/links"
import { useAppLifecycle } from "@/hooks/useAppLifecycle"
import { useSignOutReset } from "@/hooks/useSignOutReset"
import { AuthGate } from "@/components/AuthGate"
import { BootOfflineGate } from "@/components/BootConnectivity"
import { FirstRunGate } from "@/components/FirstRunGate"
import { OnboardingGate } from "@/components/onboarding/OnboardingGate"
import { ReportViewfinder } from "@/components/report/ReportViewfinder"
import { useAppearanceStore } from "@/store/appearanceStore"
import { useNotificationDeepLinks } from "@/push/useNotificationDeepLinks"
import { usePushOnSignIn } from "@/push/usePushOnSignIn"
import { applyInternalHref, useMobileNavAdapter } from "@/components/MobileNavAdapter"

export { ErrorBoundary } from "@/components/CrashScreen"

export const unstable_settings = { anchor: "index" }

setAppearancePreferenceStore({
  get: () => useAppearanceStore.getState().preference,
  set: (p) => useAppearanceStore.getState().setPreference(p),
  subscribe: (l) => useAppearanceStore.subscribe(l),
})

void SplashScreen.preventAutoHideAsync()
void SystemUI.setBackgroundColorAsync(launchTheme.colors.bg)

setWebOrigin(WEB_ORIGIN)
setSourceCommit(SOURCE_COMMIT)
setApiHost(API_URL)

const mobileCapabilities: PlatformCapabilities = {
  ...makeFakeCapabilities(),
  camera: { ...nativeCamera, Viewfinder: ReportViewfinder },
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

function requestDismissToShell(): void {
  dismissToShell?.()
}

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

function NavAdapterBridge(): null {
  useMobileNavAdapter()
  return null
}

export default function RootLayout() {
  const fonts = useAppFonts()
  const status = useAuthStore((s) => s.status)

  useBootstrap()
  useAppLifecycle()
  useSignOutReset()
  useAuthRedirect()
  usePushOnSignIn()
  useNotificationDeepLinks(requestDismissToShell)

  const { fontsReady, gateActive, gateMounted, gateStyle, boot } = useLaunchGate(fonts, status)

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
                <AppBridges />
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingGate: {
    zIndex: 60,
    elevation: 60,
  },
})
