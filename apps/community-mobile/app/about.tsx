/**
 * ABOUT civfix route - the mission modal, opened from the "civfix" logo pill on the map (the shell routes
 * the logo -> /about) and presented as a centered modal over a dim scrim (registered as a
 * transparentModal in the root layout).
 *
 * The card itself now lives in the shared @civfix/ui as <BrandAboutCard/> - ported there so the SAME card
 * also renders on web (one source, no per-app twin). This route is the mobile PRESENTATION host: it mounts
 * the shared card (which owns the scrim + centered card + spring-in) and wires its dismiss to expo-router.
 */
import React, { useCallback } from "react"
import { useRouter } from "expo-router"
import { BrandAboutCard } from "@civfix/ui"

export default function AboutScreen() {
  const router = useRouter()

  const dismiss = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }, [router])

  return <BrandAboutCard onClose={dismiss} />
}
