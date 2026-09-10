/**
 * EVENT DASHBOARD deep-link host (/dashboard).
 *
 * The dashboard is a SHARED @civfix/ui body (EventDashboardBody) rendered IN the map-home sheet by the
 * unified shell's BodyRouter (an "event-dashboard" detail), so a deep link routes through the nav store
 * rather than a full screen. This route file is the cold deep-link HOST only: a `router.push("/dashboard")`
 * lands here, seeds the unified nav store with the entry, and replaces to the map-home ("/").
 */
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function EventDashboardHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "event-dashboard" })} />
}
