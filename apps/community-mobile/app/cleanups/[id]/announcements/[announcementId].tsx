import { useLocalSearchParams } from "expo-router"
import DetailRouteHost from "@/components/DetailRouteHost"

export default function AnnouncementScreen() {
  const { id, announcementId } = useLocalSearchParams<{ id: string; announcementId: string }>()

  return (
    <DetailRouteHost
      entry={id && announcementId ? { kind: "announcement", id, announcementId } : null}
    />
  )
}
