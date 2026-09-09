import type { Metadata } from "next"

import "./org-page.css"

export const metadata: Metadata = {
  title: "Organization · civfix",
  description: "An organization hosting volunteer events on civfix.",
}

export default function OrgPageLayout({ children }: { children: React.ReactNode }) {
  return children
}
