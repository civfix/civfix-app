/**
 * NOTIFICATION PREFERENCES deep-link host (/notifications/prefs) - UI-unification Stage 4 fix.
 *
 * The notification + privacy preferences surface is a SHARED @civfix/ui body (NotificationPrefsBody)
 * rendered IN the map-home sheet by the unified shell's BodyRouter (a "notification-prefs" detail). It is an
 * IN-SHEET surface, so the activity inbox header gear and the profile "Notification settings" row both route
 * through the nav store, not a full screen. This route file remains only as the cold deep-link HOST: a
 * `router.push("/notifications/prefs")` lands here, where we SEED the unified nav store with the
 * `notification-prefs` entry and replace to the map-home ("/"), which then renders the shared prefs surface
 * in the sheet over the live map.
 *
 * The old mobile prefs body was deleted (now @civfix/ui NotificationPrefsBody); this host carries no UI.
 */
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function NotificationPrefsHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "notification-prefs" })} />
}
