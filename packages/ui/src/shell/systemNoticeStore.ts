/**
 * The founders' system notice (`/app/config`'s `announcement`, D8): which text this device dismissed, and
 * the web bar's measured height, which the web chrome below it reads across the AppShell slot boundary.
 *
 * Only a hash of the dismissed text persists: the same text stays hidden whatever its level, and a new one
 * shows again. The height is memory-only, like the promo banner's: a persisted one would push the web
 * chrome down on a load where no notice shows. Only the web bar publishes it (the phone's bar sits in the
 * layout flow), so on native it stays 0.
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { AppConfigResponse } from "@civfix/contract"
import { persistentStorage } from "../storage/persistentStorage"
import { SYSTEM_NOTICE_STORAGE_ID } from "../storage/storageIds"

export type SystemNotice = NonNullable<AppConfigResponse["announcement"]>

export const SYSTEM_NOTICE_PERSIST_NAME = "civfix.system-notice-dismissed"

/** FNV-1a over UTF-16 code units: synchronous, so a restart compares it before its first render. */
function noticeTextHash(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

export function visibleSystemNotice(
  notice: SystemNotice | null | undefined,
  dismissedHash: string | null,
): SystemNotice | null {
  if (!notice) return null
  return noticeTextHash(notice.text) === dismissedHash ? null : notice
}

export interface SystemNoticeState {
  dismissedHash: string | null
  dismiss: (text: string) => void
  height: number
  setHeight: (height: number) => void
}

export const useSystemNoticeStore = create<SystemNoticeState>()(
  persist(
    (set) => ({
      dismissedHash: null,
      // The height zeroes in the same update: the bar unmounts, and a stale height would keep the web chrome
      // pushed down for a bar no longer there.
      dismiss: (text) => set({ dismissedHash: noticeTextHash(text), height: 0 }),
      height: 0,
      setHeight: (height) => set({ height: Math.max(0, Math.round(height)) }),
    }),
    {
      // A synchronous storage hydrates during create, so a dismissed notice never flashes on the first render.
      name: SYSTEM_NOTICE_PERSIST_NAME,
      version: 1,
      storage: createJSONStorage(() => persistentStorage(SYSTEM_NOTICE_STORAGE_ID)),
      partialize: (state) => ({ dismissedHash: state.dismissedHash }),
    },
  ),
)
