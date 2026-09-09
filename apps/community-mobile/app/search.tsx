import { useNavStore } from "@civfix/ui"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function SearchRoute() {
  return <DeepLinkHost seed={() => useNavStore.getState().selectView("search")} />
}
