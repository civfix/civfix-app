import { OrgPageView } from "@/features/org-page/org-page-view"

/**
 * Catch-all public organization page. Like /e/[...slug]: the static export emits one placeholder
 * shell at out/orgs/_/index.html, the real slug is read from the live URL client-side, and the host
 * serves the shell for every /orgs/<slug> deep link (public/_redirects). functions/orgs/[[path]].ts
 * rewrites the head with a per-organization link preview on the way out.
 */
export function generateStaticParams(): Array<{ slug: string[] }> {
  return [{ slug: ["_"] }]
}

export const dynamicParams = false

export default function OrgPage() {
  return <OrgPageView />
}
