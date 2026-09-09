"use client"

// STAGE 4 SLICE 1 BODIES GALLERY route (UI-unification, documents/18-ui-unification.md).
//
// An isolated, non-product route that renders the shared @civfix/ui People/Profile bodies through
// react-native-web against fake data, so slice 1 can be VISUALLY VERIFIED at /bodies at both
// breakpoints with no backend. Loaded via next/dynamic(ssr:false) so the RNW runtime mounts client-side
// only and never executes during the static export (output: "export"). Removed/gated in Stage 5.

import dynamic from "next/dynamic"

const BodiesGallery = dynamic(() => import("@/components/dev/bodies-gallery"), {
  ssr: false,
})

export default function BodiesPage() {
  return <BodiesGallery />
}
