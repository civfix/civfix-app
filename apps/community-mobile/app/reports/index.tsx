import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function ReportsHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "myreports" })} />
}
