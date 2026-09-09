import { PinDetailRoute } from "@/features/pin/pin-detail-route"

/**
 * Static-export note: this is a CATCH-ALL ([...id]) route. With output:"export", dynamic segments
 * must enumerate their params at build time via generateStaticParams. We cannot know real report ids
 * ahead of time, so we emit a single placeholder shell ({ id: ["_"] }) and read the actual id
 * client-side (PinDetailRoute -> HomeShell -> use-web-nav-adapter's entryFromPath, which seeds the nav
 * store from window.location). To serve arbitrary /pin/<id> URLs on a static host,
 * configure a SPA fallback (rewrite unknown paths to the emitted shell). See the app README.
 */
export function generateStaticParams(): Array<{ id: string[] }> {
  return [{ id: ["_"] }]
}

export const dynamicParams = false

export default function PinDetailPage() {
  return <PinDetailRoute />
}
