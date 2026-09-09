"use client"

import { HomeShell } from "@/components/home/home-shell"

/**
 * Client entry for the /cleanups/[...id] catch-all. Renders the HomeShell, which mounts the unified
 * @civfix/ui AppShell and seeds its nav store from the live URL via the web nav adapter
 * (use-web-nav-adapter.ts reads the runtime id and maps it to the cleanup-detail panel) - the event
 * opens INSIDE the sidebar over the live map. See HomeShell.
 */
export function CleanupDetailRoute() {
  return <HomeShell />
}
