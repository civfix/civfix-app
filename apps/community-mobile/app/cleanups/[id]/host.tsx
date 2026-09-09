import { useLocalSearchParams } from "expo-router"
import DetailRouteHost from "@/components/DetailRouteHost"

export default function HostModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return <DetailRouteHost entry={id ? { kind: "host-mode", id } : null} />
}
