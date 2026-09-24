import type { Metadata } from "next"

/**
 * The landscape verification route (dev only, spec D18 / WS7). `robots: noindex, nofollow` matches
 * /bodies: it is a fake-data harness, not product content, and must never be crawled or shared.
 */
export const metadata: Metadata = {
  title: "Landscape shell (dev) · civfix",
  robots: { index: false, follow: false },
}

export default function L({ children }: { children: React.ReactNode }) {
  return children
}
