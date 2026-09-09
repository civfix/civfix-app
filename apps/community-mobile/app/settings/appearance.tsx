import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function SettingsAppearanceHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "appearance-settings" })} />
}
