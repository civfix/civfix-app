"use client"

import * as React from "react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { AppError } from "@civfix/shared"
import { colorSchemes } from "@civfix/shared/tokens"
import { ToastProvider } from "@civfix/ui"
import { I18nProvider, FALLBACK_LOCALE } from "@civfix/ui/i18n"
import {
  ThemeProvider,
  setAppearancePreferenceStore,
  useColorSchemeName,
} from "@civfix/ui/theme"
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
  type ReportSubmission,
  type ReportSubmitResult,
} from "@civfix/ui/data"

import { makeQueryClient } from "@/lib/query"
import { restorePersistedCache, installCachePersistenceWriter } from "@/lib/query-persist"
import { api } from "@/lib/api"
import { chatSocket } from "@/lib/ws"
import { webCamera } from "@/lib/web-camera"
import { webGeolocation } from "@/lib/web-geolocation"
import { runTurnstile, TURNSTILE_SITEKEY } from "@/lib/turnstile"
import { CARTO_API_KEY } from "@/lib/carto"
import { saveClaimHandoff } from "@/store/claim-handoff"
import { useAuthStore, selectAuthPending } from "@/store/auth-store"
import { useAppearanceStore } from "@/store/appearance-store"
import { useResolvedLocale } from "@/lib/locale"
import { useAuthGate } from "@/hooks/use-auth-gate"
import { useLogout } from "@/hooks/use-auth"
import { AuthHydrator } from "@/components/auth/auth-hydrator"
import { BootSplash } from "@/components/boot-splash"
import { RealtimeChannel } from "@/components/realtime/realtime-channel"
import { FirstRunGate } from "@/features/auth/first-run-gate"

setAppearancePreferenceStore({
  get: () => useAppearanceStore.getState().preference,
  set: (p) => useAppearanceStore.getState().setPreference(p),
  subscribe: (l) => useAppearanceStore.subscribe(l),
})

const webCapabilities: PlatformCapabilities = {
  ...makeFakeCapabilities(),
  camera: webCamera,
  geolocation: webGeolocation,
  openExternal: {
    open: async (url: string): Promise<void> => {
      window.open(url, "_blank", "noopener,noreferrer")
    },
  },
  blurSurface: { supported: false },
}

function useWebAuthState(): AuthState {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const pending = useAuthStore(selectAuthPending)
  const guestSmsEnabled = useAuthStore((s) => s.guestSmsEnabled)
  return normalizeAuthState({
    authed: status === "authenticated",
    pending,
    user,
    guestSmsEnabled,
  })
}

function WebDataProvider({ children }: { children: React.ReactNode }) {
  const runAuthed = useAuthGate()
  const logout = useLogout()
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated")

  const requireAuth = React.useCallback(
    (action: () => void, _opts?: { next?: string }) => {
      runAuthed(action)
    },
    [runAuthed],
  )

  const submitReport = React.useCallback(
    async (submission: ReportSubmission): Promise<ReportSubmitResult> => {
      const base = {
        idempotencyKey: submission.idempotencyKey,
        category: submission.category,
        type: submission.type,
        lat: submission.lat,
        lng: submission.lng,
        geomSource: submission.geomSource,
        mediaUploadIds: submission.mediaUploadIds,
        ...(submission.title ? { title: submission.title } : {}),
        ...(submission.description ? { description: submission.description } : {}),
        ...(submission.addr ? { addr: submission.addr } : {}),
      }

      if (isAuthenticated) {
        const dto = await api.createReport({ ...base, honeypot: "" })
        return {
          reportId: dto.id,
          lat: dto.lat,
          lng: dto.lng,
          category: dto.category,
          status: dto.status === "held" ? "held" : "published",
        }
      }

      const turnstileToken = await runTurnstile()
      if (turnstileToken.length === 0) {
        throw AppError.turnstileFailed("Turnstile token could not be minted")
      }
      const res = await api.anonCreateReport({ ...base, turnstileToken, honeypot: "" })
      saveClaimHandoff({ reportId: res.reportId, claimCode: res.claimCode })
      return {
        reportId: res.reportId,
        lat: submission.lat,
        lng: submission.lng,
        category: submission.category,
        status: res.status,
        claimCode: res.claimCode,
      }
    },
    [isAuthenticated],
  )

  const value = React.useMemo<DataContextValue>(
    () => ({
      api,
      useAuthState: useWebAuthState,
      requireAuth,
      logout,
      chatSocket,
      submitReport,
      ...(TURNSTILE_SITEKEY ? { getTurnstileToken: (action: string) => runTurnstile(action) } : {}),
      ...(CARTO_API_KEY ? { cartoApiKey: CARTO_API_KEY } : {}),
      onUserUpdated: (user) => useAuthStore.getState().setSession({ user }),
    }),
    [requireAuth, logout, submitReport],
  )

  return <ApiProvider value={value}>{children}</ApiProvider>
}

function I18nMount({ children }: { children: React.ReactNode }) {
  const { locale, setLocale } = useResolvedLocale()

  const [hydrated, setHydrated] = React.useState(false)
  React.useEffect(() => setHydrated(true), [])
  const activeLocale = hydrated ? locale : FALLBACK_LOCALE

  React.useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = activeLocale
  }, [activeLocale])

  return (
    <I18nProvider locale={activeLocale} setLocale={setLocale}>
      {children}
    </I18nProvider>
  )
}

function ThemeDomBinding(): null {
  const scheme = useColorSchemeName()

  React.useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.classList.toggle("dark", scheme === "dark")
    document.documentElement.style.colorScheme = scheme
    const paper = colorSchemes[scheme].neutral.paper
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.removeAttribute("media")
      meta.setAttribute("content", paper)
    })
  }, [scheme])

  return null
}

function ThemeMount({ children }: { children: React.ReactNode }) {
  const preference = useAppearanceStore((s) => s.preference)

  return (
    <ThemeProvider preference={preference}>
      <ThemeDomBinding />
      {children}
    </ThemeProvider>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const clientRef = React.useRef<QueryClient | null>(null)
  if (!clientRef.current) {
    clientRef.current = makeQueryClient()
    restorePersistedCache(clientRef.current)
  }

  React.useEffect(() => {
    return installCachePersistenceWriter(clientRef.current!)
  }, [])

  return (
    <QueryClientProvider client={clientRef.current}>
      <WebDataProvider>
        <CapabilitiesProvider value={webCapabilities}>
          <AuthHydrator />
          <RealtimeChannel />
          <ThemeMount>
            <I18nMount>
              <ToastProvider>
                <BootSplash>{children}</BootSplash>
                <FirstRunGate />
              </ToastProvider>
            </I18nMount>
          </ThemeMount>
        </CapabilitiesProvider>
      </WebDataProvider>
    </QueryClientProvider>
  )
}
