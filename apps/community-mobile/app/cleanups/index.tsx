import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function CleanupsHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "cleanups" })} />
}
