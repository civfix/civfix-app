import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function SettingsHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "settings" })} />
}
