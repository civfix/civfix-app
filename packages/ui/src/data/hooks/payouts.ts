import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CreateOrgPayoutResponse,
  CreateOrgStripeAccountLinkResponse,
  ListOrgPayoutsResponse,
  OrgBalanceDTO,
  OrgDonationSummaryDTO,
  OrgPaymentsStatusDTO,
  PayoutDTO,
} from "@civfix/shared"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"
import { randomId } from "../randomId"
import { appErrorCode } from "../../bodies/errorCode"

export interface OrgDonationSummaryRange {
  from?: string
  to?: string
}

export function useOrgPaymentsStatus(orgId: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<OrgPaymentsStatusDTO>({
    queryKey: queryKeys.orgPaymentsStatus(orgId ?? "unknown"),
    enabled: !!orgId && isAuthenticated && (opts.enabled ?? true),
    queryFn: () => api.getOrgPaymentsStatus({ id: orgId as string }),
    retry: false,
  })
}

export function useOrgDonationSummary(
  orgId: string | undefined,
  range: OrgDonationSummaryRange = {},
  opts: { enabled?: boolean } = {},
) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<OrgDonationSummaryDTO>({
    queryKey: queryKeys.orgDonationSummary(orgId ?? "unknown", range.from ?? "all", range.to ?? "now"),
    enabled: !!orgId && isAuthenticated && (opts.enabled ?? true),
    queryFn: () =>
      api.getOrgDonationSummary({
        id: orgId as string,
        ...(range.from ? { from: range.from } : {}),
        ...(range.to ? { to: range.to } : {}),
      }),
    retry: false,
  })
}

export function useOrgBalance(orgId: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<OrgBalanceDTO>({
    queryKey: queryKeys.orgBalance(orgId ?? "unknown"),
    enabled: !!orgId && isAuthenticated && (opts.enabled ?? true),
    queryFn: () => api.getOrgBalance({ id: orgId as string }),
    retry: false,
  })
}

export const ORG_PAYOUTS_PAGE_SIZE = 20

export function useOrgPayouts(orgId: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery<ListOrgPayoutsResponse>({
    queryKey: queryKeys.orgPayouts(orgId ?? "unknown"),
    enabled: !!orgId && isAuthenticated && (opts.enabled ?? true),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listOrgPayouts({
        id: orgId as string,
        limit: ORG_PAYOUTS_PAGE_SIZE,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage: ListOrgPayoutsResponse) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

export function payoutRows(pages: readonly ListOrgPayoutsResponse[] | undefined): PayoutDTO[] {
  return (pages ?? []).flatMap((page) => page.items)
}

export interface CreateOrgPayoutVars {
  amountMinor?: number
  idempotencyKey?: string
}

const payoutIntentKeys = new Map<string, string>()

export function payoutIntent(orgId: string, amountMinor: number | null | undefined): string {
  return `${orgId}:${amountMinor ?? "available"}`
}

export function payoutIdempotencyKey(intent: string): string {
  const held = payoutIntentKeys.get(intent)
  if (held) return held
  const minted = randomId()
  payoutIntentKeys.set(intent, minted)
  return minted
}

export function releasePayoutIntent(intent: string): void {
  payoutIntentKeys.delete(intent)
}

export function clearPayoutIntents(): void {
  payoutIntentKeys.clear()
}

const SETTLED_PAYOUT_REFUSALS: ReadonlySet<string> = new Set([
  "VALIDATION",
  "CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "RATE_LIMITED",
])

/**
 * A refusal the server ANSWERED is a settled outcome - no money moved, and the backend has already
 * spent this key on a failed row it will replay forever. The key has to rotate or the button is dead.
 * A transport failure carries no code: the request may have landed, so the key is held for the retry.
 */
export function payoutIntentSettledBy(err: unknown): boolean {
  const code = appErrorCode(err)
  return code !== undefined && SETTLED_PAYOUT_REFUSALS.has(code)
}

export function useCreateOrgPayout(orgId: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<CreateOrgPayoutResponse, unknown, CreateOrgPayoutVars | void>({
    scope: { id: `org-payout:${orgId ?? "unknown"}` },
    mutationFn: (vars) => {
      const intent = payoutIntent(orgId as string, vars?.amountMinor)
      return api.createOrgPayout({
        id: orgId as string,
        currency: "USD",
        idempotencyKey: vars?.idempotencyKey ?? payoutIdempotencyKey(intent),
        ...(vars?.amountMinor != null ? { amountMinor: vars.amountMinor } : {}),
      })
    },
    onSuccess: (_res, vars) => {
      releasePayoutIntent(payoutIntent(orgId as string, vars?.amountMinor))
      if (!orgId) return
      void qc.invalidateQueries({ queryKey: queryKeys.orgBalance(orgId) })
      void qc.invalidateQueries({ queryKey: queryKeys.orgPayouts(orgId) })
      void qc.invalidateQueries({ queryKey: queryKeys.orgDonationSummaryRoot(orgId) })
    },
    onError: (err, vars) => {
      if (payoutIntentSettledBy(err)) {
        releasePayoutIntent(payoutIntent(orgId as string, vars?.amountMinor))
      }
    },
  })
}

export type OrgStripeAccountLinkKind = "onboarding" | "update"

export function useCreateOrgStripeAccountLink(orgId: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<
    CreateOrgStripeAccountLinkResponse,
    unknown,
    { type?: OrgStripeAccountLinkKind } | void
  >({
    mutationFn: (vars) =>
      api.createOrgStripeAccountLink({ id: orgId as string, type: vars?.type ?? "onboarding" }),
    onSuccess: () => {
      if (orgId) void qc.invalidateQueries({ queryKey: queryKeys.orgPaymentsStatus(orgId) })
    },
  })
}
