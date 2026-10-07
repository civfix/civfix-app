import { HomeShell } from "@/components/home/home-shell"

/**
 * Placeholder-shell catch-all; see the static-export note in /pin/[...id]/page.tsx.
 *
 * `next dev` returns 500 on a hard refresh of a non-enumerated id. That is a dev-server artifact of
 * output: "export" with dynamicParams false; the static export plus the Cloudflare rewrite serves it.
 */
export function generateStaticParams(): Array<{ geoid: string[] }> {
  return [{ geoid: ["_"] }]
}

export const dynamicParams = false

export default function LeaderboardPage() {
  return <HomeShell />
}
