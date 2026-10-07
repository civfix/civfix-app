import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function SettingsPrivacyHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "settings-privacy" })} />
}
