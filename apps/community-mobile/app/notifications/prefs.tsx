import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function NotificationPrefsHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "notification-prefs" })} />
}
