import { HomeShell } from "@/components/home/home-shell"

/**
 * /reports - the full list of the signed-in user's reports. The web nav adapter seeds the "Your
 * reports" surface from the URL. AppShell presents it standalone without the map in portrait and in
 * the map-backed sidebar in expanded layout. The list itself is the shared @civfix/ui ReportsBody.
 */
export default function ReportsPage() {
  return <HomeShell />
}
