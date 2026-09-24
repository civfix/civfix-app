import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function NotificationsHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "activity" })} />
}
