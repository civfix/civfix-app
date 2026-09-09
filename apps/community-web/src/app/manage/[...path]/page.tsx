import type { Metadata } from "next"

import { ConsoleRoute } from "@/features/host/console-route"

export function generateStaticParams(): Array<{ path: string[] }> {
  return [{ path: ["_"] }]
}

export const dynamicParams = false

export const metadata: Metadata = {
  title: "Host console",
  robots: { index: false, follow: false },
}

export default function ManagePage() {
  return <ConsoleRoute />
}
