"use client"

import * as React from "react"
import { BrandAboutCard, useBrandAboutStore } from "@civfix/ui"

/**
 * Mobile presents the shared card as an expo-router modal; web has no router modal, so this host renders
 * it while the shared store is open, and nothing while closed so the map and controls stay interactive.
 */
export function WebBrandAbout() {
  const open = useBrandAboutStore((s) => s.open)
  const setOpen = useBrandAboutStore((s) => s.setOpen)
  if (!open) return null
  return <BrandAboutCard onClose={() => setOpen(false)} />
}
