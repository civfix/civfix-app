"use client"

// STAGE 4 SLICE 1 BODIES GALLERY route (UI-unification, documents/18-ui-unification.md).
//
// An isolated, non-product route that renders the shared @civfix/ui People/Profile bodies through
// react-native-web against fake data, so slice 1 can be VISUALLY VERIFIED at /bodies at both
// breakpoints with no backend. Loaded via next/dynamic(ssr:false) so the RNW runtime mounts client-side
// only. A `.dev.tsx` route: only `next dev` serves it (next.config.mjs pageExtensionsFor).

import dynamic from "next/dynamic"

const BodiesGallery = dynamic(() => import("@/components/dev/bodies-gallery"), {
  ssr: false,
})

export default function BodiesPage() {
  return <BodiesGallery />
}
