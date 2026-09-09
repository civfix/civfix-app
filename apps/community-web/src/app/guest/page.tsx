import { Suspense } from "react"

import { GuestCancelView } from "@/features/guest/guest-cancel-view"

export default function GuestPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-paper" aria-hidden="true" />}>
      <GuestCancelView />
    </Suspense>
  )
}
