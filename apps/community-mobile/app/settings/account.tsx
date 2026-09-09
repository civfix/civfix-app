/**
 * ACCOUNT settings deep-link host (/settings/account). See settings/index.tsx for the pattern.
 */
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function SettingsAccountHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "settings-account" })} />
}
