import { useQuery } from "@tanstack/react-query"
import type { HostExportDTO, OrganizationDTO } from "@civfix/shared"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"

export const ORG_DONATION_EXPORTS_POLL_MS = 3000

export function exportsPollInterval(
  rows: readonly HostExportDTO[] | undefined,
  pollMs: number,
  failed: boolean,
): number | false {
  if (failed) return false
  const unfinished = (rows ?? []).some(
    (row) => row.status === "queued" || row.status === "running",
  )
  return unfinished ? pollMs : false
}

export function useOrganization(slug: string | undefined) {
  const api = useApi()
  return useQuery<OrganizationDTO>({
    queryKey: queryKeys.org(slug ?? "unknown"),
    enabled: !!slug,
    queryFn: () => api.getOrganization({ slug: slug as string }),
    retry: false,
  })
}

export function useMyOrganizations() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<OrganizationDTO[]>({
    queryKey: queryKeys.myOrganizations,
    enabled: isAuthenticated,
    queryFn: async () => (await api.listMyOrganizations({})).items,
    retry: false,
  })
}

export function useOrgDonationExports(
  orgId: string | undefined,
  opts: { enabled?: boolean; pollMs?: number } = {},
) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  const pollMs = opts.pollMs ?? ORG_DONATION_EXPORTS_POLL_MS
  return useQuery<HostExportDTO[]>({
    queryKey: queryKeys.orgDonationExports(orgId ?? "unknown"),
    enabled: !!orgId && isAuthenticated && (opts.enabled ?? true),
    queryFn: async () => (await api.listOrgDonationExports({ id: orgId as string })).items,
    refetchInterval: (query) =>
      exportsPollInterval(query.state.data, pollMs, query.state.status === "error"),
    retry: false,
  })
}
