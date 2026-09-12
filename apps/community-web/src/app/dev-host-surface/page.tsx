"use client"

import dynamic from "next/dynamic"

const HostSurfacePreview = dynamic(() => import("@/components/dev/host-surface-preview"), {
  ssr: false,
})

export default function DevHostSurfacePage() {
  return <HostSurfacePreview />
}
