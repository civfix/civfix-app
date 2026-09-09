import { useLocalSearchParams } from "expo-router"
import DetailRouteHost from "@/components/DetailRouteHost"

export default function MyTicketSeatScreen() {
  const { id, seatId } = useLocalSearchParams<{ id: string; seatId: string }>()

  return (
    <DetailRouteHost
      entry={id ? { kind: "my-ticket", id, ...(seatId ? { seatId } : {}) } : null}
    />
  )
}
