import { useLocalSearchParams } from "expo-router"
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function EditCleanupHostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <DeepLinkHost
      seed={() => {
        if (id) seedEntry({ kind: "edit-cleanup", id })
      }}
      deps={[id]}
    />
  )
}
