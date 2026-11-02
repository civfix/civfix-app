import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Sub-processors · civfix",
  description: "The third-party providers civfix uses to process personal data.",
}

export default function SubprocessorsPage() {
  return <LegalPage active="subprocessors" />
}
