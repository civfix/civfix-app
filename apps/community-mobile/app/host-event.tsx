// /host-event is not on the server-link allowlist, so this host seeds the entry directly instead of
// going through applyInternalHref.
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function HostEventHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "create-cleanup" })} />
}
