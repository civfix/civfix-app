"use client"

// STAGE 2 PRIMITIVES GALLERY / VERIFICATION SURFACE (UI-unification, documents/18-ui-unification.md).
//
// This temporary, isolated route renders the full shared @civfix/ui primitives gallery through
// react-native-web so the RNW pipeline can be VISUALLY VERIFIED at /skeleton at both breakpoints. It
// is NOT part of product navigation, and as a `.dev.tsx` route only `next dev` serves it (next.config.mjs
// pageExtensionsFor). The gallery itself lives in src/components/dev/primitives-gallery.tsx.
//
// (Stage 1 rendered only <Brand/> here as the walking-skeleton proof; Stage 2 grows it into the full
// gallery.) The gallery is loaded via next/dynamic(ssr:false) so the react-native-web runtime mounts
// client-side only and never executes during the static export (output: "export").

import dynamic from "next/dynamic"

const PrimitivesGallery = dynamic(() => import("@/components/dev/primitives-gallery"), {
  ssr: false,
})

export default function SkeletonPage() {
  return <PrimitivesGallery />
}
