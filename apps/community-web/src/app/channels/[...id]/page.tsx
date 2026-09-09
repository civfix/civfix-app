import { ChannelsRoute } from "@/features/channels/channels-route"

/**
 * Static-export note: this is a CATCH-ALL ([...id]) route. With output:"export", dynamic segments
 * must enumerate their params at build time via generateStaticParams. The channel paths carry the
 * literal wizard segment ("/channels/new"), not knowable ahead of time, so we emit a single
 * placeholder shell ({ id: ["_"] }) and read the actual path client-side (ChannelsRoute -> HomeShell
 * -> use-web-nav-adapter). The SPA fallback rule `/channels/* /channels/_/ 200` in public/_redirects
 * rewrites every cold /channels/<...> deep link to this shell so it boots and resolves the path
 * client-side. See the app README.
 */
export function generateStaticParams(): Array<{ id: string[] }> {
  return [{ id: ["_"] }]
}

export const dynamicParams = false

export default function ChannelsDetailPage() {
  return <ChannelsRoute />
}
