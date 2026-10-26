import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Cookies & Storage · civfix",
  description:
    "The small set of strictly-necessary cookies and local storage civfix uses, and why we show no consent banner.",
}

export default function CookiesPage() {
  return <LegalPage active="cookies" />
}
