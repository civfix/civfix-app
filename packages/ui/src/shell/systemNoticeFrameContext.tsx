import React, { createContext, useContext } from "react"
import { useWindowDimensions } from "react-native"
import { SafeAreaInsetsContext, type EdgeInsets } from "react-native-safe-area-context"

export interface SystemNoticeFrameValue {
  /** The device's insets, as the frame received them. */
  windowInsets: EdgeInsets
  /** The window height the notice takes from the top, status bar included; 0 while none shows. */
  takenTop: number
}

/** Set by the phone's SystemNoticeFrame for the app below the notice; null everywhere else. */
export const SystemNoticeFrameContext = createContext<SystemNoticeFrameValue | null>(null)

/**
 * The window height left to the app below the phone's notice. The screens there read a top inset of 0, so a
 * layout that budgets the window height against its top inset (the sheet detents, the drop-pin camera) must
 * budget this height instead, or it would size itself as if the notice were not there.
 */
export function useShellWindowHeight(): number {
  const { height } = useWindowDimensions()
  return height - (useContext(SystemNoticeFrameContext)?.takenTop ?? 0)
}

/**
 * The insets for a surface that covers the whole window (an RN Modal), read by the component that hosts it:
 * the device's real insets below the phone's notice, and `insets` as read everywhere else.
 */
export function useFullWindowInsets<T extends EdgeInsets | null>(insets: T): T | EdgeInsets {
  return useContext(SystemNoticeFrameContext)?.windowInsets ?? insets
}

/**
 * A surface that covers the whole window (an RN Modal) is out of the frame's flow even when opened from below
 * the notice: what renders inside it reads the device's real insets and the full window height again.
 */
export function FullWindowInsets({ children }: { children: React.ReactNode }) {
  const frame = useContext(SystemNoticeFrameContext)
  if (!frame) return <>{children}</>
  return (
    <SystemNoticeFrameContext.Provider value={null}>
      <SafeAreaInsetsContext.Provider value={frame.windowInsets}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </SystemNoticeFrameContext.Provider>
  )
}
