import { useLocalSearchParams } from "expo-router"
import DetailRouteHost from "@/components/DetailRouteHost"

export default function HostLogHoursScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return <DetailRouteHost entry={id ? { kind: "host-log-hours", id } : null} />
}
