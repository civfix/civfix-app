"use client"

// The /landscape verification route (landscape redesign, spec D18 / WS7): the REAL AppShell over fake
// data, so the populated landscape surfaces can be seen with no backend. Loaded via
// dynamic(ssr:false) - like /bodies - so the react-native-web runtime, the map and the fake providers
// mount client-side only and never execute during the static export (output: "export").

import dynamic from "next/dynamic"

const LandscapePreview = dynamic(() => import("@/components/dev/landscape-preview"), {
  ssr: false,
})

export default function LandscapePage() {
  return <LandscapePreview />
}
