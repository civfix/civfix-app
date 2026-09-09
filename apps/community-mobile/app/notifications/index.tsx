/**
 * NOTIFICATIONS (activity inbox) deep-link host (/notifications) - UI-unification Stage 4 fix.
 *
 * The activity inbox is a SHARED @civfix/ui body (NotificationsBody) rendered IN the map-home sheet by the
 * unified shell's BodyRouter (an "activity" detail). It is an IN-SHEET surface now (it was the last of the
 * old mobile full-screen "overlay" kinds), so an in-app open (the map controls' Activity button) and a
 * notification deep link both route through the nav store, not a full screen. This route file remains only
 * as the cold deep-link HOST: a `router.push("/notifications")` lands here, where we SEED the unified nav
 * store with the `activity` entry and replace to the map-home ("/"), which then renders the shared inbox in
 * the sheet over the live map.
 *
 * The old mobile notifications body was deleted in slice 4 (now @civfix/ui); this host carries no list UI.
 */
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function NotificationsHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "activity" })} />
}
