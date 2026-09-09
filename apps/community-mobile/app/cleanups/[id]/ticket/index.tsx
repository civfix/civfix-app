import { useLocalSearchParams } from "expo-router"
import DetailRouteHost from "@/components/DetailRouteHost"

export default function MyTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return <DetailRouteHost entry={id ? { kind: "my-ticket", id } : null} />
}
