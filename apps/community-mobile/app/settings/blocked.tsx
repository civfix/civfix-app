import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function SettingsBlockedHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "blocked" })} />
}
