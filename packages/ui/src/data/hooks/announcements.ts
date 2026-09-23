import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import type {
  AnnouncementAudience,
  AnnouncementDTO,
  BroadcastPreviewDTO,
  CreateEventAnnouncementResponse,
  ListEventAnnouncementsResponse,
} from "@civfix/shared"
import { ANNOUNCEMENT_CHANNELS } from "@civfix/shared"
import { useApi } from "../context"
import { queryKeys } from "../keys"

export const ANNOUNCEMENTS_PAGE_SIZE = 20

export const AUDIENCE_PREVIEW_DEBOUNCE_MS = 400

export function audienceKey(audience: AnnouncementAudience): string {
  return audience.kind === "slots" ? `slots:${[...audience.ids].sort().join(",")}` : audience.kind
}

export function invalidateEventAnnouncements(qc: QueryClient, cleanupId: string): void {
  void qc.invalidateQueries({ queryKey: queryKeys.eventAnnouncementsRoot(cleanupId) })
}

export function announcementRows(
  pages: readonly ListEventAnnouncementsResponse[] | undefined,
): AnnouncementDTO[] {
  return (pages ?? []).flatMap((page) => page.items)
}

export function useEventAnnouncements(
  cleanupId: string | undefined,
  opts: { enabled?: boolean } = {},
) {
  const api = useApi()
  return useInfiniteQuery<ListEventAnnouncementsResponse>({
    queryKey: queryKeys.eventAnnouncements(cleanupId ?? "unknown"),
    enabled: !!cleanupId && (opts.enabled ?? true),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listEventAnnouncements({
        id: cleanupId as string,
        limit: ANNOUNCEMENTS_PAGE_SIZE,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage: ListEventAnnouncementsResponse) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

export function useAnnouncement(cleanupId: string | undefined, announcementId: string | undefined) {
  const api = useApi()
  return useQuery<AnnouncementDTO>({
    queryKey: queryKeys.eventAnnouncement(cleanupId ?? "unknown", announcementId ?? "unknown"),
    enabled: !!cleanupId && !!announcementId,
    queryFn: () =>
      api.getEventAnnouncement({
        id: cleanupId as string,
        announcementId: announcementId as string,
      }),
    retry: false,
  })
}

export interface CreateAnnouncementVars {
  title: string | null
  bodyMd: string
  audience: AnnouncementAudience
}

export function useCreateAnnouncement(cleanupId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<CreateEventAnnouncementResponse, unknown, CreateAnnouncementVars>({
    mutationFn: ({ title, bodyMd, audience }) =>
      api.createEventAnnouncement({
        id: cleanupId,
        ...(title === null ? {} : { title }),
        bodyMd,
        audience,
      }),
    onSuccess: (announcement) => {
      qc.setQueryData(queryKeys.eventAnnouncement(cleanupId, announcement.id), announcement)
      invalidateEventAnnouncements(qc, cleanupId)
    },
  })
}

export function useAudiencePreview(
  cleanupId: string | undefined,
  audience: AnnouncementAudience,
  opts: { enabled?: boolean } = {},
) {
  const api = useApi()
  return useQuery<BroadcastPreviewDTO>({
    queryKey: queryKeys.eventAudiencePreview(cleanupId ?? "unknown", audienceKey(audience)),
    enabled: !!cleanupId && (opts.enabled ?? true),
    queryFn: () =>
      api.previewEventBroadcast({
        id: cleanupId as string,
        segment: audience,
        channels: [...ANNOUNCEMENT_CHANNELS],
      }),
    staleTime: AUDIENCE_PREVIEW_DEBOUNCE_MS,
    retry: false,
  })
}
