import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function SettingsAccountHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "settings-account" })} />
}
