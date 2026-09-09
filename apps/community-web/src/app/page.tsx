import { HomeShell } from "@/components/home/home-shell"

/**
 * Home: feed-first in portrait, where Map is a separate tab and non-map surfaces do not mount it.
 * The expanded layout keeps the map mounted behind the persistent sidebar.
 *
 * This route renders only a client shell; all data is fetched at runtime by the components inside
 * HomeShell. The static export therefore emits just the HTML shell + JS, with no server data needs.
 */
export default function HomePage() {
  return <HomeShell />
}
