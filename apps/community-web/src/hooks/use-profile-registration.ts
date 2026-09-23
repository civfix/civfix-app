"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { isValidHandle, type UpdateProfileRequest } from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { useAuthStore } from "@/store/auth-store"
import { useCurrentUser, useIsAuthenticated } from "@/hooks/use-auth"
import { useDebouncedValue } from "@/hooks/use-debounce"

/**
 * First-run registration is required while the viewer is authenticated AND the server says their
 * profile is explicitly incomplete. We gate ONLY on an explicit `false` so older sessions/servers that
 * omit the flag never get locked out.
 */
export function useFirstRunRequired(): boolean {
  const isAuthenticated = useIsAuthenticated()
  const user = useCurrentUser()
  return isAuthenticated && user?.profileComplete === false
}

/**
 * Debounced username (handle) availability check, gated on a syntactically valid, non-empty handle so
 * we never hit the network for an obviously-invalid value. Keyed by the lowercased handle (citext).
 */
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

/**
 * Submit first-run registration (PUT /me/profile). On success the returned user carries
 * profileComplete=true, which we write into the auth store - that flips useFirstRunRequired() to false
 * and dismisses the gate.
 */
export function useUpdateProfile() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: (input: UpdateProfileRequest) => api.updateProfile(input),
    onSuccess: (res) => setSession({ user: res.user }),
  })
}
