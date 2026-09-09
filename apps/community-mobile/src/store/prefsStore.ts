/**
 * Prefs store (zustand) — currently just the app-language preference.
 *
 * Holds the active, resolved app `locale` and the `setLocale` action the shared LanguageSettingsBody calls
 * (via the LocaleContext seam the host wires into <I18nProvider>). It is the mobile half of the locale
 * persistence contract (§2.5 of the i18n design):
 *
 *   setLocale(code):
 *     (a) writes the explicit choice to MMKV (`civfix.locale`) so it survives restarts/offline and wins on
 *         the next launch's resolution,
 *     (b) drives the provider by updating store state (the root layout reads `locale` and passes it to
 *         <I18nProvider>, which calls i18next.changeLanguage), and
 *     (c) if the viewer is authed, persists it server-side via the shared client's `updateSettings({locale})`
 *         (PUT /me/settings) so it becomes the cross-device source of truth and reaches server-rendered copy.
 *
 * The store is SEEDED once at app start with the resolved locale (root layout calls `setInitialLocale`),
 * so the first render already reflects the explicit choice / authed user / device language. A bare store
 * default of 'en' covers the brief window before seeding.
 *
 * Note: MMKV writes and the i18next language change are synchronous/instant; the server PATCH is
 * fire-and-forget (a failed sync — offline — leaves the local choice intact, re-synced on a later switch).
 */
import { create } from "zustand"
import type { SupportedLocale } from "@civfix/ui/i18n"
import { api } from "@/api/client"
import { useAuthStore } from "@/store/authStore"
import { resolveActiveLocale } from "@/lib/locale"
import { storage } from "@/lib/mmkv"
import { LOCALE_KEY } from "@/lib/mmkv-keys"

interface PrefsState {
  /** The active, resolved app locale driving <I18nProvider>. */
  locale: SupportedLocale
  /**
   * Seed the resolved locale at app start WITHOUT writing MMKV or PATCHing the server (this is the
   * already-resolved value, not a new user choice). Idempotent; safe to call as the resolved value changes
   * (e.g. once the authed user hydrates and there was no explicit MMKV choice).
   */
  setInitialLocale: (code: SupportedLocale) => void
  /**
   * The user's explicit switch: persist to MMKV, drive the provider, and (if authed) sync to the server.
   * This is what LanguageSettingsBody calls.
   */
  setLocale: (code: SupportedLocale) => void
}

export const usePrefsStore = create<PrefsState>((set, get) => ({
  // Seed synchronously from the device/MMKV signals available at module load so the FIRST paint is already
  // localized (the authed user isn't known yet — the root layout re-seeds via setInitialLocale once it
  // hydrates, and a manual switch then wins). Falls back to 'en' on a non-native runtime.
  locale: resolveActiveLocale(null),

  setInitialLocale: (code) => {
    if (get().locale !== code) set({ locale: code })
  },

  setLocale: (code) => {
    if (get().locale !== code) set({ locale: code })

    // (a) Persist the explicit choice so it wins on the next launch and survives offline.
    try {
      storage.set(LOCALE_KEY, code)
    } catch {
      // MMKV unavailable (web bundle / static export eval): the in-memory state change above still drives
      // the provider for this session.
    }

    // (c) If authed, make it the cross-device source of truth + reach server-rendered copy. Fire-and-forget:
    // an offline failure leaves the local choice intact, re-synced on a later switch. Also refresh the
    // cached user so a relaunch's resolution sees the new server locale.
    if (useAuthStore.getState().status === "authed") {
      void (async () => {
        try {
          const res = await api.updateSettings({ locale: code })
          if (res.user) useAuthStore.getState().setUser(res.user)
        } catch {
          // Sync failed (offline / server): keep the local choice; it re-syncs on the next switch.
        }
      })()
    }
  },
}))
