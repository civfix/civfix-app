import type { Metadata } from "next"

// Long-form document styling for every /legal/* route. Imported once here (the route-group layout) so
// each document page stays content-only. See src/app/legal/legal.css.
import "./legal.css"

export const metadata: Metadata = {
  title: "Legal · civfix",
  robots: { index: true, follow: true },
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return children
}
