import { useLocalSearchParams } from "expo-router"
import DetailRouteHost from "@/components/DetailRouteHost"

export default function PersonHostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return <DetailRouteHost entry={id ? { kind: "person", id } : null} />
}
