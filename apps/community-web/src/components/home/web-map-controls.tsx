"use client"

import * as React from "react"
import { MapControls, useAppPromoStore } from "@civfix/ui"
import { useTotalUnread } from "@civfix/ui/data"

import { useMapRecenterStore } from "@/features/map/map-recenter"

/**
 * Web wrapper for the shared MapControls (UI-unification Stage 4 slice 5B-1) - the thin web-app glue
 * that replaces the deleted DOM TopBar in the AppShell `mapControls` slot.
 *
 * The shared MapControls own the whole control surface (brand/locate/layers + the right view-stack +
 * the report action + the expanded-layout profile/auth entry, all wired to the unified nav store /
 * shared filter store / shared data seam). This wrapper supplies only the two host-specific bits the
 * shared component takes as props:
 *   - `unreadCount`: the messages-unread total (any unread lights the Messaging button's dot). Read from
 *     the SHARED @civfix/ui `useTotalUnread` - the same badge hook mobile's map home uses (see the body
 *     comment).
 *   - `onLocate`: the map recenter. The map lives in a SEPARATE AppShell slot (a distinct dynamic chunk),
 *     so HomeMap registers its recenter into the `map-recenter` bus and this reads it back.
 *
 * The brand button opens the shared "About civfix" modal through the shared brand-about store, which
 * <WebBrandAbout/> observes in its own AppShell overlay slot - the SAME call the landscape Rail's brand
 * pill makes, so both layouts open one card. `topInset` nudges the row down to the design's ~14px top.
 */
export function WebMapControls() {
  // The SHARED badge hook (@civfix/ui/data), NOT a derivation off the infinite `useThreads` inbox and
  // NOT a web-local flat `useQuery<MessageThreadDTO[]>`. It owns a tiny single-page count query on the
  // sibling `["threads","unread"]` key, so:
  //   - this always-mounted control row never keeps the INFINITE inbox query active, which would make
  //     React Query refetch EVERY loaded inbox page on each `["threads"]` invalidation (one per inbound
  //     DM signal / read-ack) once the user has scrolled the inbox a few pages deep; and
  //   - nothing here fights the inbox body over the shape of the one `["threads"]` cache entry - the
  //     collision that the older web-local flat query caused.
  // The badge key is a CHILD of `["threads"]`, so badge and inbox still refresh from one invalidation.
  const unreadCount = useTotalUnread()
  const recenter = useMapRecenterStore((s) => s.recenter)

  const onLocate = React.useCallback(() => {
    recenter?.()
  }, [recenter])

  // The portrait app-download banner (<AppDownloadBanner/>) is a fixed strip at the very top of the
  // viewport, in a DIFFERENT AppShell slot, so it publishes its measured height through the shared promo
  // store and we fold it into the control row's top inset. It is 0 whenever no banner is showing
  // (desktop, dismissed, installed PWA), leaving the original 6px design offset untouched.
  const bannerHeight = useAppPromoStore((s) => s.bannerHeight)

  return (
    <MapControls
      topInset={6 + bannerHeight}
      unreadCount={unreadCount}
      onLocate={onLocate}
    />
  )
}
