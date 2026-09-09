import { HomeShell } from "@/components/home/home-shell"

/**
 * /events - the viewer's Events view. The web nav adapter seeds the Events / cleanups surface from the
 * URL. AppShell presents it as a standalone portrait surface without the map; expanded layout places
 * the same surface in the sidebar while keeping the map mounted.
 */
export default function EventsPage() {
  return <HomeShell />
}
