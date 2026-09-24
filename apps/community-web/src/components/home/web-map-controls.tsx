"use client"

import * as React from "react"
import { MapControls, useAppPromoStore } from "@civfix/ui"
import { useTotalUnread } from "@civfix/ui/data"

import { useMapRecenterStore } from "@/features/map/map-recenter"

/**
 * The map lives in a separate AppShell slot (a distinct dynamic chunk), so HomeMap registers its recenter
 * in the `map-recenter` store and `onLocate` reads it back from there.
 */
export function WebMapControls() {
  // Not derived from the infinite `useThreads` inbox: this row is always mounted, and keeping that query
  // active would refetch every loaded inbox page on each `["threads"]` invalidation. The badge key is a
  // child of `["threads"]`, so badge and inbox still refresh from one invalidation.
  const unreadCount = useTotalUnread()
  const recenter = useMapRecenterStore((s) => s.recenter)

  const onLocate = React.useCallback(() => {
    recenter?.()
  }, [recenter])

  // The app-download banner is a fixed strip in a different slot, so its measured height arrives through
  // the promo store. It is 0 whenever no banner shows, leaving the 6px design offset untouched.
  const bannerHeight = useAppPromoStore((s) => s.bannerHeight)

  return (
    <MapControls
      topInset={6 + bannerHeight}
      unreadCount={unreadCount}
      onLocate={onLocate}
    />
  )
}
