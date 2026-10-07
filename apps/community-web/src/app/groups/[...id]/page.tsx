import { HomeShell } from "@/components/home/home-shell"

/**
 * output: "export" needs every dynamic segment enumerated at build time, so this emits one placeholder
 * shell and the real path is read client-side. public/_redirects rewrites every /groups/<...> deep
 * link to that shell.
 */
export function generateStaticParams(): Array<{ id: string[] }> {
  return [{ id: ["_"] }]
}

export const dynamicParams = false

export default function GroupsDetailPage() {
  return <HomeShell />
}
