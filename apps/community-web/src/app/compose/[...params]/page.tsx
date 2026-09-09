import { HomeShell } from "@/components/home/home-shell"

/** Runtime quote targets are resolved client-side from /compose/quote/:postId. */
export function generateStaticParams(): Array<{ params: string[] }> {
  return [{ params: ["_"] }]
}

export const dynamicParams = false

export default function QuoteComposePage() {
  return <HomeShell />
}
