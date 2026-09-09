import { HomeShell } from "@/components/home/home-shell"

/** Runtime post ids are resolved client-side; Cloudflare rewrites /post/* to this exported shell. */
export function generateStaticParams(): Array<{ id: string[] }> {
  return [{ id: ["_"] }]
}

export const dynamicParams = false

export default function PostPage() {
  return <HomeShell />
}
