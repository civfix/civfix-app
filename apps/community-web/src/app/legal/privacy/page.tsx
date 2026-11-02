import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy · civfix",
  description: "What civfix collects, why, who we share it with, and your choices.",
}

export default function PrivacyPage() {
  return <LegalPage active="privacy" />
}
