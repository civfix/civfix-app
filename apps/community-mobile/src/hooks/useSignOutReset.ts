import { useEffect } from "react"
import { useRouter } from "expo-router"
import { useNavStore } from "@civfix/ui"
import { isSignOutTransition } from "@/lib/authLifecycle"
import { beginNavTeardown, goHome } from "@/lib/goHome"
import { useAuthStore } from "@/store/authStore"

export function useSignOutReset(): void {
  const router = useRouter()

  useEffect(
    () =>
      useAuthStore.subscribe((state, previous) => {
        if (!isSignOutTransition(previous.status, state.status)) return
        beginNavTeardown()
        useNavStore.getState().reset()
        if (router.canDismiss()) goHome(router)
      }),
    [router],
  )
}
