/**
 * SETTINGS HUB deep-link host (/settings).
 *
 * The hub is a SHARED @civfix/ui body (SettingsBody) rendered by the unified shell's BodyRouter (a
 * "settings" detail), so in-app navigation goes through the nav store (`push({ kind: "settings" })`),
 * never through expo-router. This file is only the COLD deep-link host: a `router.push("/settings")`
 * lands here, seeds the entry and replaces to the map-home ("/"), which renders the shared body.
 */
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function SettingsHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "settings" })} />
}
