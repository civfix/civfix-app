import { HomeShell } from "@/components/home/home-shell"

/**
 * Catch-all jurisdiction leaderboard route (`/leaderboard/<geoid>`).
 *
 * Static-export note (same shape as /pin/[...id] and /people/[...id]): with output:"export" a dynamic
 * segment must enumerate its params at build time, and we cannot know real GEOIDs ahead of time, so we
 * emit a single placeholder shell at out/leaderboard/_/index.html and read the real GEOID client-side.
 * HomeShell mounts the shared @civfix/ui AppShell, whose web nav adapter seeds the nav store from the
 * live window.location via `entryFromPath` - which already maps `/leaderboard/<geoid>` to the existing
 * `leaderboard` DetailKind, so the leaderboard opens INSIDE the panel over the live map. Arbitrary
 * /leaderboard/<geoid> URLs are served by the SPA-fallback rule in public/_redirects.
 *
 * `next dev` returns 500 on a hard refresh of a non-enumerated catch-all id; that is a dev-server
 * artifact of output:"export" + dynamicParams:false, not a production behavior. The static export plus
 * the Cloudflare rewrite serves it correctly.
 */
export function generateStaticParams(): Array<{ geoid: string[] }> {
  return [{ geoid: ["_"] }]
}

export const dynamicParams = false

export default function LeaderboardPage() {
  return <HomeShell />
}
