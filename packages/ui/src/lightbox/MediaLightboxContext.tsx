import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { MediaLightboxView } from "./MediaLightbox"
import type { LightboxItem, MediaLightboxContextValue } from "./MediaLightbox.types"

const MediaLightboxContext = createContext<MediaLightboxContextValue | null>(null)
MediaLightboxContext.displayName = "MediaLightboxContext"

export interface MediaLightboxProviderProps {
  children: React.ReactNode
}

/** Comfortably past the Modal's fade-out. */
const RELEASE_AFTER_CLOSE_MS = 400

export function MediaLightboxProvider({ children }: MediaLightboxProviderProps) {
  const [visible, setVisible] = useState(false)
  const [items, setItems] = useState<LightboxItem[]>([])
  const [index, setIndex] = useState(0)

  // The provider lives for the whole session, so it must not keep the last gallery's items (possibly large
  // blob URLs the holder wants to revoke) reachable after dismissal. The release waits for the fade-out
  // so the media does not blank mid-animation.
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelRelease = useCallback(() => {
    if (releaseTimer.current === null) return
    clearTimeout(releaseTimer.current)
    releaseTimer.current = null
  }, [])
  useEffect(() => cancelRelease, [cancelRelease])

  const open = useCallback(
    (next: LightboxItem[], startIndex = 0) => {
      if (next.length === 0) return
      cancelRelease()
      const clamped = Math.min(Math.max(startIndex, 0), next.length - 1)
      setItems(next)
      setIndex(clamped)
      setVisible(true)
    },
    [cancelRelease],
  )

  const close = useCallback(() => {
    setVisible(false)
    cancelRelease()
    releaseTimer.current = setTimeout(() => {
      releaseTimer.current = null
      setItems([])
      setIndex(0)
    }, RELEASE_AFTER_CLOSE_MS)
  }, [cancelRelease])

  const value = useMemo<MediaLightboxContextValue>(() => ({ open, close }), [open, close])

  return (
    <MediaLightboxContext.Provider value={value}>
      {children}
      <MediaLightboxView
        visible={visible}
        items={items}
        index={index}
        onIndexChange={setIndex}
        onClose={close}
      />
    </MediaLightboxContext.Provider>
  )
}

// Unlike useCapabilities, which throws, the lightbox is an enhancement: a body rendered outside the
// provider (such as ConversationBody on mobile's standalone /messages/[id] route, which bypasses the
// AppShell mount) must degrade to "tap does nothing", never crash.
const NOOP_LIGHTBOX: MediaLightboxContextValue = { open: () => {}, close: () => {} }

export function useLightbox(): MediaLightboxContextValue {
  return useContext(MediaLightboxContext) ?? NOOP_LIGHTBOX
}
