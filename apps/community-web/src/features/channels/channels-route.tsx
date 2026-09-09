"use client"

import { HomeShell } from "@/components/home/home-shell"

/**
 * Client entry for the /channels/[...id] catch-all (Telegram-style chat, P5). Renders the SAME
 * single-screen HomeShell as `/`; the shell mounts the unified @civfix/ui AppShell and seeds its nav
 * store from the live URL via the web nav adapter (use-web-nav-adapter.ts reads the runtime path from
 * window.location and maps it through @civfix/ui's entryFromPath, so `/channels/new` -> the
 * create-channel wizard opens INSIDE the sidebar over the live map). A channel CONVERSATION rides the
 * group rails as /messages/group/<id>, not here. The placeholder shell ("/channels/_") seeds nothing
 * and shows the home view. See HomeShell.
 */
export function ChannelsRoute() {
  return <HomeShell />
}
