import { create } from "zustand"

export const SYSTEM_NOTICE_PERSIST_NAME = "civfix.system-notice-dismissed"

export interface SystemNoticeState {
  dismissedHash: string | null
  dismiss: (text: string) => void
  height: number
  setHeight: (height: number) => void
}

export const useSystemNoticeStore = create<SystemNoticeState>()(() => ({
  dismissedHash: null,
  dismiss: () => {
    throw new Error("not implemented")
  },
  height: 0,
  setHeight: () => {
    throw new Error("not implemented")
  },
}))
