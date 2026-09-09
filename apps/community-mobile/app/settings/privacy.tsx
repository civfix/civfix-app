/**
 * PRIVACY & SAFETY settings deep-link host (/settings/privacy). See settings/index.tsx.
 */
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function SettingsPrivacyHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "settings-privacy" })} />
}
