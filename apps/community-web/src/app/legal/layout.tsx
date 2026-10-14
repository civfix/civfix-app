import type { Metadata } from "next"

// Imported once in the layout so every /legal/* document page stays content-only.
import "./legal.css"

export const metadata: Metadata = {
  title: "Legal · civfix",
  robots: { index: true, follow: true },
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return children
}
