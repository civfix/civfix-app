"use client"

import { HomeShell } from "@/components/home/home-shell"

/**
 * Client entry for the /groups/[...id] catch-all (Telegram-style chat, P4). Renders the SAME
 * single-screen HomeShell as `/`; the shell mounts the unified @civfix/ui AppShell and seeds its nav
 * store from the live URL via the web nav adapter (use-web-nav-adapter.ts reads the runtime path from
 * window.location and maps it through @civfix/ui's entryFromPath, so `/groups/new` -> the create-group
 * wizard and `/groups/<id>/info` -> the group management surface open INSIDE the sidebar over the live
 * map). The placeholder shell ("/groups/_") seeds nothing and shows the home view. See HomeShell.
 */
export function GroupsRoute() {
  return <HomeShell />
}
