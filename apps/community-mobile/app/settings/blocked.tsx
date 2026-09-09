/**
 * BLOCKED ACCOUNTS deep-link host (/settings/blocked) - the path `pathForEntry` has always emitted for
 * the `blocked` kind, which until now had no mobile route to land on. See settings/index.tsx.
 */
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function SettingsBlockedHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "blocked" })} />
}
