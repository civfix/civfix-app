/**
 * EVENTS (cleanups) browse deep-link host (/cleanups, /events) - UI-unification Stage 4 fix.
 *
 * The events list is a SHARED @civfix/ui body (EventsBody) rendered IN the map-home sheet by the unified
 * shell's BodyRouter (the "events" list tab). It is an IN-SHEET surface, so an in-app open (the map
 * controls' Events button) and a deep link both route through the nav store, not a full screen. This route
 * file remains only as the cold deep-link HOST: a `router.push("/cleanups")` lands here, where we SEED the
 * unified nav store with the `cleanups` entry (the store's `seed` action maps that list kind onto the
 * compact "events" tab) and replace to the map-home ("/"), which then renders the shared events list in
 * the sheet over the live map.
 *
 * The old mobile Events body + EventCard list were deleted (now @civfix/ui EventsBody); this host has no UI.
 */
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function CleanupsHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "cleanups" })} />
}
