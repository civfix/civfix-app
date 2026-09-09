"use client"

import * as React from "react"
import { BrandAboutCard, useBrandAboutStore } from "@civfix/ui"

/**
 * The "About civfix" modal web presentation host.
 *
 * The shared <BrandAboutCard/> (the mission modal) is the SAME component the mobile /about route renders.
 * Mobile presents it as an expo-router transparentModal; web has no router modal, so this supplies the
 * presentation. The OPEN-STATE now lives in the shared @civfix/ui `useBrandAboutStore` (lifted out of this
 * file) so a shared surface can request it open from either orientation: the map's "civfix" logo pill in
 * portrait (MapControls) and the landscape Rail's own logo pill, which both call the shared
 * `openBrandAbout()`.
 *   - <WebBrandAbout/> observes the shared store and renders the card (scrim + centered card + spring-in)
 *     while open, and nothing while closed (so the map/controls stay interactive).
 */

/** The web presentation host: renders the shared About card in the AppShell overlay slot while open. */
export function WebBrandAbout() {
  const open = useBrandAboutStore((s) => s.open)
  const setOpen = useBrandAboutStore((s) => s.setOpen)
  if (!open) return null
  return <BrandAboutCard onClose={() => setOpen(false)} />
}
