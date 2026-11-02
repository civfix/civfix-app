import type { Metadata } from "next"

import { NotificationUnsubscribeView } from "@/features/unsubscribe/notification-unsubscribe-view"

import "../unsubscribe.css"

export const metadata: Metadata = {
  title: "Email notifications · civfix",
  description: "Stop one kind of civfix notification email.",
  robots: { index: false, follow: false },
}

export default function NotificationUnsubscribePage() {
  return <NotificationUnsubscribeView />
}
