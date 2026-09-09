import { GroupsRoute } from "@/features/groups/groups-route"

/**
 * Static-export note: this is a CATCH-ALL ([...id]) route. With output:"export", dynamic segments
 * must enumerate their params at build time via generateStaticParams. The group paths carry runtime
 * ids and the literal wizard segment ("/groups/new", "/groups/<id>/info"), none knowable ahead of
 * time, so we emit a single placeholder shell ({ id: ["_"] }) and read the actual path client-side
 * (GroupsRoute -> HomeShell -> use-web-nav-adapter). The SPA fallback rule `/groups/* /groups/_/ 200`
 * in public/_redirects rewrites every cold /groups/<...> deep link to this shell so it boots and
 * resolves the path client-side. See the app README.
 */
export function generateStaticParams(): Array<{ id: string[] }> {
  return [{ id: ["_"] }]
}

export const dynamicParams = false

export default function GroupsDetailPage() {
  return <GroupsRoute />
}
