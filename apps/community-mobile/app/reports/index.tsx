/**
 * MY REPORTS deep-link host (/reports) - UI-unification Stage 4 fix.
 *
 * The viewer's reports list is a SHARED @civfix/ui body (ReportsBody) rendered IN the map-home sheet by the
 * unified shell's BodyRouter (the "reports" list tab). It is an IN-SHEET surface, so an in-app open and a
 * deep link both route through the nav store, not a full screen. This route file remains only as the cold
 * deep-link HOST: a `router.push("/reports")` (a notification tap, a cross-flow link) lands here, where we
 * SEED the unified nav store with the matching `myreports` entry (the store's `seed` action maps that list
 * kind onto the compact "reports" tab) and replace to the map-home ("/"), which then renders the shared
 * reports list in the sheet.
 *
 * The old mobile Reports body was deleted in slice 2 (now @civfix/ui); this host carries no list UI.
 */
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function ReportsHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "myreports" })} />
}
