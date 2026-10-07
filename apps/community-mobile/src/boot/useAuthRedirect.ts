import { useEffect } from "react"
import { useRouter, useSegments } from "expo-router"
import { useAuthStore } from "@/store/authStore"
import { goHome } from "@/lib/goHome"

export function useAuthRedirect() {
  const router = useRouter()
  const segments = useSegments()
  const status = useAuthStore((s) => s.status)

  useEffect(() => {
    if (status === "idle" || status === "loading") return
    if (status === "authed" && segments[0] === "auth") {
      goHome(router)
    }
  }, [status, segments, router])
}
