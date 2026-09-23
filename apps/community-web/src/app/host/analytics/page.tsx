import type { Metadata } from "next"

import { HomeShell } from "@/components/home/home-shell"

export const metadata: Metadata = {
  title: "Analytics · civfix",
}

export default function HostAnalyticsPage() {
  return <HomeShell />
}
