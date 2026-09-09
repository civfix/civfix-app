"use client"

import { HomeShell } from "@/components/home/home-shell"

/**
 * Client entry for the /pin/[...id] catch-all. Renders the SAME single-screen HomeShell as `/`; the
 * shell mounts the unified @civfix/ui AppShell and seeds its nav store from the live URL via the web
 * nav adapter (use-web-nav-adapter.ts reads the runtime id from window.location - the
 * static-export-safe pattern - and maps it to the matching pin panel), so a deep link opens the pin
 * detail INSIDE the sidebar over the live map (not a separate full page). The placeholder shell
 * ("/pin/_") seeds nothing and shows the home view. See HomeShell.
 */
export function PinDetailRoute() {
  return <HomeShell />
}
