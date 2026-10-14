"use client"

// Loaded with ssr: false so the react-native-web runtime mounts client-side only and never runs
// during the static export. Only `next dev` serves `.dev.tsx` routes (pageExtensionsFor in
// next.config.mjs).

import dynamic from "next/dynamic"

const BodiesGallery = dynamic(() => import("@/components/dev/bodies-gallery"), {
  ssr: false,
})

export default function BodiesPage() {
  return <BodiesGallery />
}
