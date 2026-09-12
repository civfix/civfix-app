"use client"

import dynamic from "next/dynamic"

const DashboardPreview = dynamic(() => import("@/components/dev/dashboard-preview"), {
  ssr: false,
})

export default function DevDashboardPage() {
  return <DashboardPreview />
}
