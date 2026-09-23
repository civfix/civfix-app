import type { QueryClient, InfiniteData } from "@tanstack/react-query"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  BBox,
  ReportClusterResponse,
  ReportDTO,
  ReportPinDTO,
  ReportCategory,
  ReportType,
  ReportStatus,
  ReportVisibility,
  ListMyReportsResponse,
  ListReportsSearchResponse,
  JurisdictionDTO,
} from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"
import { optimisticPatch } from "../optimistic"
import { NEARBY_RADIUS_KM, bboxAround, roundNearbyCoord } from "./nearbyBbox"
import { isAddressNotFound } from "./resolveAddress"

function coerceMyReportPages(
  data: InfiniteData<ListMyReportsResponse>,
): InfiniteData<ListMyReportsResponse> {
  return {
    ...data,
    pages: data.pages.map((p) => ({
      ...p,
      items: Array.isArray(p?.items) ? p.items.filter((r) => r != null) : [],
    })),
  }
}

export function useMyReports(limit = 20) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery<ListMyReportsResponse>({
    queryKey: queryKeys.myReports(limit),
    enabled: isAuthenticated,
    queryFn: ({ pageParam }) =>
      api.listMyReports({
        limit,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage: ListMyReportsResponse) => lastPage.nextCursor ?? undefined,
    select: coerceMyReportPages,
  })
}

export function useReport(id: string | undefined) {
  const api = useApi()
  return useQuery<ReportDTO>({
    queryKey: queryKeys.report(id ?? "unknown"),
    enabled: !!id,
    queryFn: () => api.getReport({ id: id as string }),
    retry: false,
  })
}

export function roundJurisdictionCoord(n: number): number {
  return Math.round(n * 100000) / 100000
}

/** The jurisdiction covering a point, `null` when none does; rethrows a transient failure so it is not cached. */
export async function fetchJurisdiction(
  api: Pick<ApiClient, "resolveJurisdiction">,
  lat: number,
  lng: number,
): Promise<JurisdictionDTO | null> {
  try {
    return (await api.resolveJurisdiction({ lat, lng })) ?? null
  } catch (err) {
    if (isAddressNotFound(err)) return null
    throw err
  }
}

export function useResolveJurisdiction(point: { lat: number; lng: number } | null) {
  const api = useApi()
  const lat = point ? roundJurisdictionCoord(point.lat) : 0
  const lng = point ? roundJurisdictionCoord(point.lng) : 0
  return useQuery<JurisdictionDTO | null>({
    queryKey: queryKeys.jurisdiction(lat, lng),
    enabled: point !== null,
    queryFn: () => fetchJurisdiction(api, lat, lng),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

const POINTS_FETCH_ZOOM = 16

export interface MapReportsArgs {
  bbox: BBox | null
  categories?: readonly ReportCategory[]
  enabled?: boolean
}

export function useMapReports({ bbox, categories, enabled }: MapReportsArgs) {
  const api = useApi()
  const cats = categories ?? []
  return useQuery<ReportClusterResponse>({
    queryKey: queryKeys.mapReports(bbox, cats),
    enabled: bbox !== null && (enabled ?? cats.length > 0),
    queryFn: () =>
      api.mapReports({
        bbox: bbox as BBox,
        zoom: POINTS_FETCH_ZOOM,
        ...(cats.length > 0 ? { categories: [...cats] } : {}),
      }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: false,
  })
}

const PICKER_BBOX_PAD_DEG = 0.0225
function roundPickerCoord(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function useNearbyReportPins(point: { lat: number; lng: number } | null) {
  const api = useApi()
  const lat = point ? roundPickerCoord(point.lat) : 0
  const lng = point ? roundPickerCoord(point.lng) : 0
  return useQuery<ReportPinDTO[]>({
    queryKey: queryKeys.nearbyReportPins(lat, lng),
    enabled: point !== null,
    queryFn: async () => {
      const res = await api.mapReports({
        bbox: {
          west: lng - PICKER_BBOX_PAD_DEG,
          east: lng + PICKER_BBOX_PAD_DEG,
          south: lat - PICKER_BBOX_PAD_DEG,
          north: lat + PICKER_BBOX_PAD_DEG,
        },
        zoom: 16,
      })
      return Array.isArray(res?.pins) ? res.pins.filter((p) => p != null) : []
    },
    retry: false,
    staleTime: 60 * 1000,
  })
}

export function useNearbyReports(
  center: { lat: number; lng: number } | null,
  radiusKm = NEARBY_RADIUS_KM,
) {
  const api = useApi()
  const lat = center ? roundNearbyCoord(center.lat) : 0
  const lng = center ? roundNearbyCoord(center.lng) : 0
  return useQuery<ReportPinDTO[]>({
    queryKey: queryKeys.nearbyReports(lat, lng, radiusKm),
    enabled: center !== null,
    queryFn: async () => {
      const res = await api.mapReports({
        bbox: bboxAround({ lat, lng }, radiusKm),
        zoom: POINTS_FETCH_ZOOM,
      })
      return Array.isArray(res?.pins) ? res.pins.filter((p) => p != null) : []
    },
    placeholderData: (prev) => prev,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
  })
}

const SEARCH_PAGE_SIZE = 30

export function useReportSearch(
  params: {
    q?: string
    categories?: readonly ReportCategory[]
    types?: readonly ReportType[]
  },
  options: { enabled?: boolean } = {},
) {
  const api = useApi()
  const q = params.q ?? ""
  const categories = params.categories
  const types = params.types
  const query = useInfiniteQuery<ListReportsSearchResponse>({
    queryKey: [...queryKeys.reportSearch(q, [...(categories ?? [])].sort()), [...(types ?? [])].sort()],
    enabled: options.enabled ?? true,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.searchReports({
        q,
        categories: categories?.length ? [...categories] : undefined,
        types: types?.length ? [...types] : undefined,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
        limit: SEARCH_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
    staleTime: 30_000,
  })
  const items: ReportPinDTO[] = (query.data?.pages ?? []).flatMap((p) =>
    Array.isArray(p?.items) ? p.items.filter((it): it is ReportPinDTO => it != null) : [],
  )
  return {
    items,
    fetchNextPage: () => {
      void query.fetchNextPage()
    },
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch()
    },
  }
}

interface ResolveReportAlsoCtx {
  prevLists?: ReadonlyArray<readonly [readonly unknown[], InfiniteData<ListMyReportsResponse> | undefined]>
}

function patchReportStatusInLists(qc: QueryClient, id: string, status: ReportStatus): void {
  qc.setQueriesData<InfiniteData<ListMyReportsResponse>>(
    { queryKey: queryKeys.myReportsRoot },
    (prev) =>
      prev
        ? {
            ...prev,
            pages: prev.pages.map((page) => ({
              ...page,
              items: page.items.map((r) => (r.id === id ? { ...r, status } : r)),
            })),
          }
        : prev,
  )
}

export function useResolveReport(id: string) {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation(
    optimisticPatch<ReportDTO, boolean, ReportDTO, ResolveReportAlsoCtx>(qc, {
      key: queryKeys.report(id),
      mutationFn: (resolved) => api.resolveReport({ id, resolved }),
      patch: (prev, resolved) => ({ ...prev, status: resolved ? "resolved" : "published" }),
      reconcile: (_prev, res) => res,
      also: {
        cancel: (client) => client.cancelQueries({ queryKey: queryKeys.myReportsRoot }),
        onMutate: (client, resolved): ResolveReportAlsoCtx => {
          const prevLists = client.getQueriesData<InfiniteData<ListMyReportsResponse>>({
            queryKey: queryKeys.myReportsRoot,
          })
          patchReportStatusInLists(client, id, resolved ? "resolved" : "published")
          return { prevLists }
        },
        onError: (client, _resolved, ctx) => {
          if (ctx?.prevLists) {
            for (const [key, data] of ctx.prevLists) client.setQueryData(key as unknown[], data)
          }
        },
        onSuccess: (client, res) => {
          patchReportStatusInLists(client, id, res.status)
        },
      },
    }),
  )
}

interface UnlistReportAlsoCtx {
  prevLists?: ReadonlyArray<readonly [readonly unknown[], InfiniteData<ListMyReportsResponse> | undefined]>
}

function patchReportVisibilityInLists(qc: QueryClient, id: string, visibility: ReportVisibility): void {
  qc.setQueriesData<InfiniteData<ListMyReportsResponse>>(
    { queryKey: queryKeys.myReportsRoot },
    (prev) =>
      prev
        ? {
            ...prev,
            pages: prev.pages.map((page) => ({
              ...page,
              items: page.items.map((r) => (r.id === id ? { ...r, visibility } : r)),
            })),
          }
        : prev,
  )
}

export function useUnlistReport(id: string) {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation(
    optimisticPatch<ReportDTO, boolean, ReportDTO, UnlistReportAlsoCtx>(qc, {
      key: queryKeys.report(id),
      mutationFn: (unlisted) => api.unlistReport({ id, unlisted }),
      patch: (prev, unlisted) => ({ ...prev, visibility: unlisted ? "hidden" : "public" }),
      reconcile: (_prev, res) => res,
      also: {
        cancel: (client) => client.cancelQueries({ queryKey: queryKeys.myReportsRoot }),
        onMutate: (client, unlisted): UnlistReportAlsoCtx => {
          const prevLists = client.getQueriesData<InfiniteData<ListMyReportsResponse>>({
            queryKey: queryKeys.myReportsRoot,
          })
          patchReportVisibilityInLists(client, id, unlisted ? "hidden" : "public")
          return { prevLists }
        },
        onError: (client, _unlisted, ctx) => {
          if (ctx?.prevLists) {
            for (const [key, data] of ctx.prevLists) client.setQueryData(key as unknown[], data)
          }
        },
        onSuccess: (client, res) => {
          patchReportVisibilityInLists(client, id, res.visibility)
          void client.invalidateQueries({ queryKey: ["map", "reports"] })
        },
      },
    }),
  )
}
