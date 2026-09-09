import { useNavStore } from "@civfix/ui"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function MapRoute() {
  return <DeepLinkHost seed={() => useNavStore.getState().selectView("map")} />
}
