import { HomeShell } from "@/components/home/home-shell"

/**
 * /notifications - the full activity list. The web nav adapter seeds the Activity surface from the
 * URL. AppShell presents it standalone without the map in portrait and in the map-backed sidebar in
 * expanded layout.
 */
export default function NotificationsPage() {
  return <HomeShell />
}
