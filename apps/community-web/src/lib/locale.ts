"use client"

/**
 * The shared <I18nProvider> never reads `navigator` or storage itself (that would break native), so the
 * web host owns detection and persistence here. The resolution order lives once in @civfix/ui/i18n
 * `resolveActiveLocale`; this module supplies only the two browser leaf reads.
 */
import * as React from "react"
import {
  resolveActiveLocale as resolveActiveLocaleFrom,
  resolveLocale,
  type LocaleSources,
  type SupportedLocale,
} from "@civfix/ui/i18n"

import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth-store"

/** Same key as the mobile MMKV store. */
export const LOCALE_STORAGE_KEY = "civfix.locale"

function readStoredLocale(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    // Private-mode / disabled storage: fall through to the next resolution source.
    return null
  }
}

function writeStoredLocale(code: SupportedLocale): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, code)
  } catch {
    // Ignore: the in-memory React state + server sync still carry the choice this session.
  }
}

// Records which user's server locale missed the last settings sync, so the choice is synced on that
// user's next confirmed session instead of being lost. Scoped by user id: on a shared browser another
// account's server setting must never be rewritten from this device's stored choice.
const UNSYNCED_LOCALE_KEY = "civfix.locale.unsynced"

function readUnsyncedUserId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(UNSYNCED_LOCALE_KEY)
  } catch {
    return null
  }
}

function writeUnsyncedUserId(userId: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (userId === null) window.localStorage.removeItem(UNSYNCED_LOCALE_KEY)
    else window.localStorage.setItem(UNSYNCED_LOCALE_KEY, userId)
  } catch {
    // Storage unavailable: nothing can outlive this page load, so there is nothing to retry.
  }
}

/** Drops the pending-sync marker when its viewer leaves this browser; it names a user id. */
export function forgetUnsyncedLocale(): void {
  writeUnsyncedUserId(null)
}

function syncServerLocale(userId: string, code: SupportedLocale): Promise<void> {
  return api.updateSettings({ locale: code }).then(
    () => writeUnsyncedUserId(null),
    () => writeUnsyncedUserId(userId),
  )
}

/**
 * Retry a locale settings sync that failed for the now-confirmed user. Runs only on a live-confirmed session
 * (never the optimistic snapshot, which has no CSRF token yet).
 */
export function reconcileUnsyncedLocale(): Promise<void> {
  const { status, optimistic, user } = useAuthStore.getState()
  if (status !== "authenticated" || optimistic || !user) return Promise.resolve()
  if (readUnsyncedUserId() !== user.id) return Promise.resolve()
  const stored = readStoredLocale()
  if (stored === null) {
    writeUnsyncedUserId(null)
    return Promise.resolve()
  }
  return syncServerLocale(user.id, resolveLocale(stored))
}

function browserLocaleTag(): string | null {
  if (typeof navigator === "undefined") return null
  const list = navigator.languages
  if (list && list.length > 0) return list[0] ?? null
  return navigator.language ?? null
}

const webLocaleSources: LocaleSources = {
  readStored: readStoredLocale,
  platformLocale: browserLocaleTag,
}

function resolveActiveLocale(userLocale?: string | null): SupportedLocale {
  return resolveActiveLocaleFrom(webLocaleSources, userLocale)
}

export function useResolvedLocale(): {
  locale: SupportedLocale
  setLocale: (code: SupportedLocale) => void
} {
  // Subscribing seeds the language from the server when a session check lands on a fresh install.
  const userLocale = useAuthStore((s) => s.user?.locale ?? null)
  const confirmedUserId = useAuthStore((s) =>
    s.status === "authenticated" && !s.optimistic ? (s.user?.id ?? null) : null,
  )

  React.useEffect(() => {
    if (confirmedUserId !== null) void reconcileUnsyncedLocale()
  }, [confirmedUserId])

  const [locale, setLocaleState] = React.useState<SupportedLocale>(() =>
    resolveActiveLocale(userLocale),
  )

  // An explicit stored choice still wins over the server value; `resolveActiveLocale` checks it first.
  React.useEffect(() => {
    setLocaleState(resolveActiveLocale(userLocale))
  }, [userLocale])

  const setLocale = React.useCallback((code: SupportedLocale) => {
    const next = resolveLocale(code)
    writeStoredLocale(next)
    setLocaleState(next)

    // The server value drives server-generated text and cross-device sync. A failed settings sync is
    // recorded and retried on this user's next confirmed session; the local choice already took effect.
    const { status, user, setSession } = useAuthStore.getState()
    if (status === "authenticated" && user) {
      setSession({ user: { ...user, locale: next } })
      void syncServerLocale(user.id, next)
    }
  }, [])

  return { locale, setLocale }
}
