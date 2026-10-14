import { HomeShell } from "@/components/home/home-shell"

/** Placeholder-shell catch-all; see the static-export note in /pin/[...id]/page.tsx. */
export function generateStaticParams(): Array<{ id: string[] }> {
  return [{ id: ["_"] }]
}

export const dynamicParams = false

export default function CleanupDetailPage() {
  return <HomeShell />
}
