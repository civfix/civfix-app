"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { isValidHandle, type UpdateProfileRequest } from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { useAuthStore } from "@/store/auth-store"
import { useCurrentUser, useIsAuthenticated } from "@/hooks/use-auth"
import { useDebouncedValue } from "@civfix/ui/data"

/** Gates only on an explicit `false`, so a session or server that omits the flag never locks anyone out. */
export function useFirstRunRequired(): boolean {
  const isAuthenticated = useIsAuthenticated()
  const user = useCurrentUser()
  return isAuthenticated && user?.profileComplete === false
}

/** Keyed by the lowercased handle because the server compares handles case-insensitively (citext). */
export function useHandleAvailability(handle: string) {
  const debounced = useDebouncedValue(handle.trim(), 350)
  const valid = isValidHandle(debounced)
  return useQuery({
    queryKey: queryKeys.handleAvailable(debounced.toLowerCase()),
    enabled: valid,
    queryFn: () => api.checkHandle({ handle: debounced }),
    retry: false,
  })
}

export function useUpdateProfile() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: (input: UpdateProfileRequest) => api.updateProfile(input),
    onSuccess: (res) => setSession({ user: res.user }),
  })
}
