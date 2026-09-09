import type { Metadata } from "next"

import { UnsubscribeView } from "@/features/unsubscribe/unsubscribe-view"

import "./unsubscribe.css"

export const metadata: Metadata = {
  title: "Unsubscribed · civfix",
  description: "You have been unsubscribed from this event's messages.",
  robots: { index: false, follow: false },
}

export default function UnsubscribePage() {
  return <UnsubscribeView />
}
