/**
 * MY PROFILE deep-link host (/profile) - UI-unification Stage 4 fix.
 *
 * The own-profile is a SHARED @civfix/ui body (ProfileBody) rendered IN the map-home sheet by the unified
 * shell's BodyRouter (a "profile" detail). It is an IN-SHEET surface now (it was one of the old mobile
 * full-screen "overlay" kinds), so the map-home sheet header's profile avatar and a deep link both route
 * through the nav store, not a full screen. This route file remains only as the cold deep-link HOST: a
 * `router.push("/profile")` lands here, where we SEED the unified nav store with the `profile` entry and
 * replace to the map-home ("/"), which then renders the shared profile in the sheet over the live map.
 *
 * The old mobile profile body was deleted in slice 1 (now @civfix/ui); this host carries no profile UI.
 */
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function ProfileHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "profile" })} />
}
