"use client"

// Loaded with ssr: false so the react-native-web runtime mounts client-side only and never runs
// during the static export. Only `next dev` serves `.dev.tsx` routes (pageExtensionsFor in
// next.config.mjs).

import dynamic from "next/dynamic"

const PrimitivesGallery = dynamic(() => import("@/components/dev/primitives-gallery"), {
  ssr: false,
})

export default function SkeletonPage() {
  return <PrimitivesGallery />
}
