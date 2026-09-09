import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function PeopleHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "people" })} />
}
