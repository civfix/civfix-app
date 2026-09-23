"use client"

/**
 * Web locale resolution + persistence (i18n design §2.5).
 *
 * The shared <I18nProvider> (from "@civfix/ui/i18n") never reads `navigator`/storage itself (that would
 * break native), so the WEB host owns detection + persistence here and injects the resolved `locale`
 * plus a `setLocale` action via the provider.
 *
 * Resolution ORDER is not owned here: the shared `resolveActiveLocale` (@civfix/ui/i18n) holds the one
 * priority chain both hosts run - explicit stored choice → authed `user.locale` → platform language →
 * "en", each clamped to {en,es,de,ko}. This module supplies the two WEB leaf reads it needs:
 *   - the explicit choice in localStorage["civfix.locale"],
 *   - the browser locale (`navigator.languages` / `navigator.language`).
 *
 * `setLocale(code)` (a) writes localStorage, (b) updates the auth-store user so the choice sticks across
 * re-renders, and (c) when authed, PATCHes the server (`client.updateSettings({ locale })`) so server-
 * generated copy + cross-device sync follow. The actual i18next language switch is driven by the
 * provider reacting to the new `locale` prop (changeLanguage), so this module only owns persistence.
 *
 * `useResolvedLocale()` exposes the resolved locale as React state (re-renders on change) plus the
 * `setLocale` action, which the layout/providers feed straight into <I18nProvider>.
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

/** localStorage key for the user's explicit language choice (matches the design + mobile MMKV key). */
export const LOCALE_STORAGE_KEY = "civfix.locale"

/** Read the explicit stored choice (window-guarded for the static-export prerender). */
function readStoredLocale(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    // Private-mode / disabled storage: fall through to the next resolution source.
    return null
  }
}

/** Persist the explicit choice (best-effort; storage may be unavailable). */
function writeStoredLocale(code: SupportedLocale): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, code)
  } catch {
    // Ignore: the in-memory React state + server sync still carry the choice this session.
  }
}

// Records which user's server locale missed the last PATCH, so the choice is synced on that user's
// next confirmed session instead of being lost. Scoped by user id: on a shared browser another
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
 * Retry a locale PATCH that failed for the now-confirmed user. Runs only on a live-confirmed session
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

/** The first browser-advertised locale tag, preferring the ordered `languages` list. */
function browserLocaleTag(): string | null {
  if (typeof navigator === "undefined") return null
  const list = navigator.languages
  if (list && list.length > 0) return list[0] ?? null
  return navigator.language ?? null
}

/** The two WEB leaf reads the shared priority chain resolves through. */
const webLocaleSources: LocaleSources = {
  readStored: readStoredLocale,
  platformLocale: browserLocaleTag,
}

/**
 * Resolve the active locale from the four sources, clamped to a supported locale. The ORDER (explicit
 * stored choice → authed user.locale → platform language → "en") is policy and lives once in
 * `@civfix/ui/i18n`; this host supplies only the two browser leaf reads above. `userLocale` is the authed
 * user's server `user.locale` (or null when signed out / not yet loaded).
 */
export function resolveActiveLocale(userLocale?: string | null): SupportedLocale {
  return resolveActiveLocaleFrom(webLocaleSources, userLocale)
}

/**
 * Host hook driving the i18n provider: returns the resolved `locale` (React state, so a switch re-renders
 * the whole tree) and a `setLocale` action that persists the choice.
 *
 * The resolved locale re-derives whenever the authed `user.locale` changes (e.g. a fresh session check on
 * a new device seeds the UI from the server) — but an explicit local choice in storage always wins over
 * the server value, matching §2.5 ("a local switch immediately overrides and syncs up").
 */
export function useResolvedLocale(): {
  locale: SupportedLocale
  setLocale: (code: SupportedLocale) => void
} {
  // The authed user's server locale (null when signed out). Subscribing keeps the resolved value in sync
  // when a session check arrives and seeds the language on a fresh install.
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

  // Re-derive when the server locale changes — unless the user already made an explicit local choice,
  // which `resolveActiveLocale` honors first (stored choice wins).
  React.useEffect(() => {
    setLocaleState(resolveActiveLocale(userLocale))
  }, [userLocale])

  const setLocale = React.useCallback((code: SupportedLocale) => {
    const next = resolveLocale(code)
    // (a) instant + offline: persist the explicit choice and re-render the tree.
    writeStoredLocale(next)
    setLocaleState(next)

    // (b) when authed, make the server the source of truth (server-generated copy + cross-device sync).
    // Mirror the new value into the auth store so the snapshot + other readers stay in lockstep, then
    // PATCH /me/settings. A failure is recorded and retried on this user's next confirmed session;
    // the local choice already took effect.
    const { status, user, setSession } = useAuthStore.getState()
    if (status === "authenticated" && user) {
      setSession({ user: { ...user, locale: next } })
      void syncServerLocale(user.id, next)
    }
  }, [])

  return { locale, setLocale }
}
