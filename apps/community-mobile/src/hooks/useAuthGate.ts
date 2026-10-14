import { useCallback } from "react"
import { useRouter } from "expo-router"
import { useAuthStore } from "@/store/authStore"

export interface AuthGate {
  requireAuth: (next: string, action?: () => void) => void
}

export function useAuthGate(): AuthGate {
  const router = useRouter()
  const status = useAuthStore((s) => s.status)

  const requireAuth = useCallback(
    (next: string, action?: () => void): void => {
      if (status === "authed") {
        action?.()
        return
      }
      router.navigate({ pathname: "/auth" as const, params: { next } })
    },
    [status, router],
  )

  return { requireAuth }
}
