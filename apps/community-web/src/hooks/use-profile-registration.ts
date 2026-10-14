"use client"

import { useCurrentUser, useIsAuthenticated } from "@/hooks/use-auth"

/** Gates only on an explicit `false`, so a session or server that omits the flag never locks anyone out. */
export function useFirstRunRequired(): boolean {
  const isAuthenticated = useIsAuthenticated()
  const user = useCurrentUser()
  return isAuthenticated && user?.profileComplete === false
}
