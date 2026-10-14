import { create } from "zustand"
import type { SupportedLocale } from "@civfix/ui/i18n"
import { api } from "@/api/client"
import { useAuthStore } from "@/store/authStore"
import { resolveActiveLocale } from "@/lib/locale"
import { storage } from "@/lib/mmkv"
import { LOCALE_KEY } from "@/lib/mmkvKeys"

interface PrefsState {
  locale: SupportedLocale
  // Seeds an already-resolved value, not a user choice, so it must not write MMKV or sync to the server.
  setInitialLocale: (code: SupportedLocale) => void
  setLocale: (code: SupportedLocale) => void
}

export const usePrefsStore = create<PrefsState>((set, get) => ({
  // Seeded at module load so the first paint is already localized; the root layout re-seeds once the
  // authed user hydrates.
  locale: resolveActiveLocale(null),

  setInitialLocale: (code) => {
    if (get().locale !== code) set({ locale: code })
  },

  setLocale: (code) => {
    if (get().locale !== code) set({ locale: code })

    try {
      storage.set(LOCALE_KEY, code)
    } catch {
      // MMKV is unavailable in a web bundle; the in-memory state still drives this session.
    }

    // The cached user is refreshed so a relaunch's locale resolution sees the new server value.
    if (useAuthStore.getState().status === "authed") {
      void (async () => {
        try {
          const res = await api.updateSettings({ locale: code })
          if (res.user) useAuthStore.getState().setUser(res.user)
        } catch {
          // Fire-and-forget: a failed sync keeps the local choice, which re-syncs on the next switch.
        }
      })()
    }
  },
}))
