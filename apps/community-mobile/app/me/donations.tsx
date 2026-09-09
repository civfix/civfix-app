import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function MyDonationsHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "my-donations" })} />
}
