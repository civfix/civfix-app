/**
 * LANGUAGE deep-link host (/settings/language) - same previously-missing route as settings/blocked.
 */
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function SettingsLanguageHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "language-settings" })} />
}
