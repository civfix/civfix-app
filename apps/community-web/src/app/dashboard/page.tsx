import { HomeShell } from "@/components/home/home-shell"

/**
 * /dashboard - the signed-in viewer's event dashboard. The web nav adapter seeds the event-dashboard
 * surface from the URL. AppShell presents it as a standalone portrait surface without the map; expanded
 * layout places the same surface in the sidebar while keeping the map mounted.
 */
export default function DashboardPage() {
  return <HomeShell />
}
