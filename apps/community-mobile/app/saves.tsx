import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function SavesHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "saves" })} />
}
