import { HomeShell } from "@/components/home/home-shell"

/**
 * output: "export" needs every dynamic segment enumerated at build time, so this emits one placeholder
 * shell and the real path is read client-side. public/_redirects rewrites every /channels/<...> deep
 * link to that shell.
 */
export function generateStaticParams(): Array<{ id: string[] }> {
  return [{ id: ["_"] }]
}

export const dynamicParams = false

// A channel conversation rides the group routes as /messages/group/<id>, not this one.
export default function ChannelsDetailPage() {
  return <HomeShell />
}
