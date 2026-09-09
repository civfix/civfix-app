/**
 * LEADERBOARD deep-link host (/leaderboard/[geoid]) - slice 8 (P3/P10 discovery leaderboard).
 *
 * The leaderboard is a SHARED @civfix/ui body (LeaderboardBody) rendered IN the map-home sheet by the
 * unified shell's BodyRouter (`BODY_LAYOUT.leaderboard === "scroll"`). `leaderboard` is an IN-SHEET kind,
 * so an in-app open and a deep link both route through the nav store, not a full screen. This route file
 * exists only as the cold deep-link HOST: an OS URL open (`civfix://leaderboard/0644000`) or a
 * `router.push("/leaderboard/<geoid>")` lands here, where we SEED the unified nav store with the matching
 * `leaderboard` entry and replace to the map-home ("/"), which then renders the shared leaderboard in the
 * sheet over the live map - the same surface as an in-app open.
 *
 * WHY THIS FILE IS REQUIRED even though "/leaderboard/" is on `ALLOWED_LINK_PREFIXES`: that allowlist
 * only governs the NOTIFICATION path, which goes href -> `applyInternalHref` -> `entryFromPath` ->
 * `seedEntry` (src/components/MobileNavAdapter.tsx) and never touches file-based routing. An OS URL open
 * DOES go through file-based routing, and without a matching route file it lands on expo-router's
 * Unmatched Route screen. Every other allowlisted prefix already has such a shim.
 *
 * The param is named `geoid` (not `id`) because that is the field the shared `DetailEntry` carries for
 * this kind - `entryFromPath("/leaderboard/<geoid>")` produces `{ kind: "leaderboard", geoid }`, and
 * seeding the same shape here keeps the OS-open path and the notification path byte-identical.
 */
import { useLocalSearchParams } from "expo-router"
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function LeaderboardHostScreen() {
  const { geoid } = useLocalSearchParams<{ geoid: string }>()

  return (
    <DeepLinkHost
      seed={() => {
        if (geoid) seedEntry({ kind: "leaderboard", geoid })
      }}
      deps={[geoid]}
    />
  )
}
