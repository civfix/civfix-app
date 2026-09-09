import { useLocalSearchParams } from "expo-router"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function DmThreadHostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <DeepLinkHost
      to={id ? { pathname: "/messages/[id]", params: { id, roomKind: "dm" } } : "/"}
      deps={[id]}
    />
  )
}
