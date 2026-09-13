import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query"
import type {
  DonateState,
  DonationDTO,
  DonationPageDTO,
  GetMyDonationReceiptResponse,
  ListMyDonationsResponse,
} from "@civfix/shared"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"

export function donationsOffered(state: DonateState | null | undefined): boolean {
  return state === "READY"
}

export function useMyDonations(opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery<ListMyDonationsResponse>({
    queryKey: queryKeys.myDonations,
    enabled: isAuthenticated && (opts.enabled ?? true),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listMyDonations({ ...(typeof pageParam === "string" ? { cursor: pageParam } : {}) }),
    getNextPageParam: (lastPage: ListMyDonationsResponse) => lastPage.nextCursor ?? undefined,
    staleTime: 10_000,
    retry: false,
  })
}

export function donationRows(
  pages: readonly ListMyDonationsResponse[] | undefined,
): DonationDTO[] {
  return (pages ?? []).flatMap((page) => page.items)
}

export function useMyDonationReceipt() {
  const api = useApi()
  return useMutation<GetMyDonationReceiptResponse, unknown, { id: string }>({
    mutationFn: ({ id }) => api.getMyDonationReceipt({ id }),
    gcTime: 0,
  })
}

export function useOrgDonationPage(slug: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  return useQuery<DonationPageDTO>({
    queryKey: queryKeys.orgDonate(slug ?? "unknown"),
    enabled: !!slug && (opts.enabled ?? true),
    queryFn: () => api.getPublicOrgDonationPage({ slug: slug as string }),
    retry: false,
  })
}
