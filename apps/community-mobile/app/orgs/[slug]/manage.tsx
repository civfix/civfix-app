import { useLocalSearchParams } from "expo-router"
import DetailRouteHost from "@/components/DetailRouteHost"

export default function OrgManageScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()

  return <DetailRouteHost entry={slug ? { kind: "org-manage", slug } : null} />
}
