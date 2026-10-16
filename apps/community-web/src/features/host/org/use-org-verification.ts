"use client"

import { useQuery } from "@tanstack/react-query"
import type { OrganizationVerificationDTO } from "@civfix/contract"
import { useApi } from "@civfix/ui/data"

import { consoleKeys } from "../console-keys"

export function useOrgVerification(orgId: string, enabled = true) {
  const api = useApi()
  return useQuery<OrganizationVerificationDTO>({
    queryKey: consoleKeys.orgVerification(orgId),
    enabled,
    queryFn: () => api.getOrganizationVerification({ id: orgId }),
    retry: false,
  })
}
