import { useLocalSearchParams } from "expo-router"
import DetailRouteHost from "@/components/DetailRouteHost"

export default function OrgScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()

  return <DetailRouteHost entry={slug ? { kind: "org", slug } : null} />
}
