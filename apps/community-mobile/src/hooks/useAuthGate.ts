import { useCallback } from "react"
import { useRouter } from "expo-router"
import { useAuthStore, type AuthStatus } from "@/store/authStore"

function isSettlingStatus(status: AuthStatus): boolean {
  return status === "idle" || status === "loading"
}

export interface AuthGate {
  status: AuthStatus
  isAuthed: boolean
  isSettling: boolean
  isSignedOut: boolean
  requireAuth: (next: string, action?: () => void, opts?: { replace?: boolean }) => boolean
}

export function useAuthGate(): AuthGate {
  const router = useRouter()
  const status = useAuthStore((s) => s.status)

  const requireAuth = useCallback(
    (next: string, action?: () => void, opts?: { replace?: boolean }): boolean => {
      if (status === "authed") {
        action?.()
        return true
      }
      const target = { pathname: "/auth" as const, params: { next } }
      if (opts?.replace) router.replace(target)
      else router.navigate(target)
      return false
    },
    [status, router],
  )

  return {
    status,
    isAuthed: status === "authed",
    isSettling: isSettlingStatus(status),
    isSignedOut: status !== "authed" && !isSettlingStatus(status),
    requireAuth,
  }
}
