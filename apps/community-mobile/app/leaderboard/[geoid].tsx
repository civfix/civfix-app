// ALLOWED_LINK_PREFIXES only covers the notification path; an OS URL open goes through file-based
// routing and needs this file. The param is `geoid` because that is the field DetailEntry carries.
import { useLocalSearchParams } from "expo-router"
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function LeaderboardHostScreen() {
  const { geoid } = useLocalSearchParams<{ geoid: string }>()

  return (
    <DeepLinkHost
      seed={() => {
        if (geoid) seedEntry({ kind: "leaderboard", geoid })
      }}
      deps={[geoid]}
    />
  )
}
