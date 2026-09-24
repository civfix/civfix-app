import { useEffect } from "react"
import { setUnauthorizedHandler } from "@/api/client"
import { useAuthStore } from "@/store/authStore"
import { adoptStorageEnvironment } from "@/lib/legacyStorageReset"
import { errorName } from "@/lib/errorName"

export function useBootstrap() {
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      useAuthStore.getState().markUnauthed()
    })
    void adoptStorageEnvironment()
      .catch((err: unknown) => {
        console.warn("[storage-env] the storage purge failed; hydrating anyway", errorName(err))
      })
      .finally(() => {
        void hydrate()
      })
    return () => setUnauthorizedHandler(null)
  }, [hydrate])
}
