import { useLocalSearchParams } from "expo-router"
import DetailRouteHost from "@/components/DetailRouteHost"

export default function CleanupHostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return <DetailRouteHost entry={id ? { kind: "cleanup", id } : null} />
}
