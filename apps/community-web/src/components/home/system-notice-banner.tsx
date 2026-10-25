"use client"

import * as React from "react"
import { SystemNoticeBanner } from "@civfix/ui"

import { Z_APP_BANNER } from "@/styles/z-layers"

// The download banner's layer: above the whole AppShell, and still under the first-run gate.
const LAYER = { zIndex: Z_APP_BANNER }

export function WebSystemNoticeBanner() {
  return <SystemNoticeBanner style={LAYER} />
}
