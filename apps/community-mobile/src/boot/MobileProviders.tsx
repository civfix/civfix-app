import React, { useCallback, useEffect, useMemo } from "react"
import { ApiProvider, normalizeAuthState, type AuthState, type DataContextValue } from "@civfix/ui/data"
import { I18nProvider } from "@civfix/ui/i18n"
import { CARTO_API_KEY } from "@/config"
import { api } from "@/api/client"
import { chatSocket } from "@/lib/ws"
import { resolveActiveLocale } from "@/lib/locale"
import { useAuthGate } from "@/hooks/useAuthGate"
import { useAuthStore } from "@/store/authStore"
import { usePrefsStore } from "@/store/prefsStore"

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

export function MobileDataProvider({ children }: { children: React.ReactNode }) {
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

export function MobileI18nProvider({ children }: { children: React.ReactNode }) {
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
