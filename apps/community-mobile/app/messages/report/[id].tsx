import { useLocalSearchParams } from "expo-router"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function ReportThreadHostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <DeepLinkHost
      to={id ? { pathname: "/messages/[id]", params: { id, roomKind: "report" } } : "/"}
      deps={[id]}
    />
  )
}
