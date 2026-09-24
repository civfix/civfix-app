import type { Metadata } from "next"

/** A dev-only fake-data harness, not product content, so it must never be crawled or shared. */
export const metadata: Metadata = {
  title: "Landscape shell (dev) · civfix",
  robots: { index: false, follow: false },
}

export default function L({ children }: { children: React.ReactNode }) {
  return children
}
