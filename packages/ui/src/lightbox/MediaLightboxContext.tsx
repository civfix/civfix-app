/**
 * MediaLightboxContext - the React context + <MediaLightboxProvider> that owns the lightbox overlay.
 *
 * A host wraps its tree in <MediaLightboxProvider> once near the root; any descendant body calls
 * `useLightbox().open(items, startIndex)` to view uploaded photos/videos full-screen. The provider
 * holds the (visible / items / index) state, exposes a STABLE { open, close } handle through context,
 * and renders the platform-split <MediaLightboxView> overlay alongside {children}. (Mirrors the
 * CapabilitiesProvider / useCapabilities pattern: a missing provider throws loudly.)
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { MediaLightboxView } from "./MediaLightbox"
import type { LightboxItem, MediaLightboxContextValue } from "./MediaLightbox.types"

const MediaLightboxContext = createContext<MediaLightboxContextValue | null>(null)
MediaLightboxContext.displayName = "MediaLightboxContext"

export interface MediaLightboxProviderProps {
  children: React.ReactNode
}

/** How long after close() we drop the item list - comfortably past the Modal's fade-out. */
const RELEASE_AFTER_CLOSE_MS = 400

export function MediaLightboxProvider({ children }: MediaLightboxProviderProps) {
  const [visible, setVisible] = useState(false)
  const [items, setItems] = useState<LightboxItem[]>([])
  const [index, setIndex] = useState(0)

  // The provider is mounted for the WHOLE session, so it must not keep the last gallery's item list (and
  // its urls - large blob/object-URLs on web the holder may want to revoke) reachable after dismissal.
  // The release is deferred past the fade-out so the media does not blank mid-animation.
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
      // Clamp the start index into range so a bad call site never lands on an empty slot.
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

  // Stable handle: open/close keep identity even while the overlay is hidden, so call sites can hold it.
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

// A stable no-op handle for when no provider is mounted. Unlike useCapabilities (which THROWS because the
// app cannot function without its platform seam), the lightbox is an ENHANCEMENT: a body that calls
// useLightbox() outside a provider - e.g. ConversationBody on the mobile standalone /messages/[id] route,
// which bypasses the AppShell mount - must degrade to "tap does nothing", never crash. Hosts opt INTO the
// feature by mounting <MediaLightboxProvider> (AppShell does so for every in-shell surface; a standalone
// full-screen route enables it by wrapping its own root in the provider).
const NOOP_LIGHTBOX: MediaLightboxContextValue = { open: () => {}, close: () => {} }

/**
 * Access the imperative lightbox handle. Returns a stable no-op when no provider is mounted, so a body
 * rendered outside a provider degrades gracefully (tap does nothing) instead of crashing.
 */
export function useLightbox(): MediaLightboxContextValue {
  return useContext(MediaLightboxContext) ?? NOOP_LIGHTBOX
}
