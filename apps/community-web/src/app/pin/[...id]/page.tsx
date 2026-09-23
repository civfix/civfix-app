import { PinDetailRoute } from "@/features/pin/pin-detail-route"

/**
 * output: "export" needs every dynamic segment enumerated at build time, so this emits one placeholder
 * shell and the real report id is read client-side. public/_redirects rewrites every /pin/<id> deep
 * link to that shell.
 */
export function generateStaticParams(): Array<{ id: string[] }> {
  return [{ id: ["_"] }]
}

export const dynamicParams = false

export default function PinDetailPage() {
  return <PinDetailRoute />
}
