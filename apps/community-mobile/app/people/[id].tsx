/**
 * PERSON profile deep-link host (/people/[id]) - UI-unification Stage 4 fix; amended in slice 8 (P8).
 *
 * The person profile is a SHARED @civfix/ui body (PersonDetailBody). As of slice 8 it is a FULL body
 * (`BODY_LAYOUT.person === "full"`), rendered by the unified shell's OVERLAY layer - NOT the sheet - on
 * every platform, exactly like `new-group` and `new-channel`. What did NOT change is the routing: `person`
 * still lives in the nav store, so an in-app open and a deep link both go through the store rather than a
 * full expo-router screen. This route file therefore remains exactly what it was, the cold deep-link HOST:
 * a `router.push("/people/<id>")` (a notification tap, the conversation header's onOpenProfile, a
 * cross-flow link) lands here, where we SEED the nav store with the matching `person` entry and replace to
 * the map-home ("/"), which then renders the shared profile as a full-page overlay over the live map - the
 * same surface as an in-app open. `seedEntry({ kind: "person", id })` is still exactly right; a full body
 * is a rendering decision inside the shell, not a different seed.
 *
 * THIS IS DELIBERATELY NOT A STANDALONE SCREEN, and there is deliberately no `person` branch in
 * `MobileNavAdapter.handleActive`. Bridging the person page out to a pushed screen would put it ABOVE the
 * whole shell, and `PersonDetailBody` pushes five children onto the nav store (`pin`, `cleanup`,
 * `followers`, `following`, a nested `person`) that would then land BEHIND the pushed screen as dead taps -
 * there are no `app/followers/` or `app/following/` routes to bridge them to, and the `pin`/`cleanups`
 * hosts `replace("/")`, which would destroy the person screen rather than stack on it. Kept in the store,
 * each child rides as a sheet over the retained person overlay and Back pops back to the profile. See the
 * reversal banner in the release plan's WP28 for the full argument before "finishing" DU section 6.
 *
 * The old mobile person-profile body was deleted in slice 1 (now @civfix/ui); this host carries no UI.
 */
import { useLocalSearchParams } from "expo-router"
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function PersonHostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <DeepLinkHost
      seed={() => {
        if (id) seedEntry({ kind: "person", id })
      }}
      deps={[id]}
    />
  )
}
