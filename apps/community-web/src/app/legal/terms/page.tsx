import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service · civfix",
  description: "The terms that govern your use of civfix.",
}

export default function TermsPage() {
  return <LegalPage active="terms" />
}
