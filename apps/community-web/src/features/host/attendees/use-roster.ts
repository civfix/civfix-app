"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import type {
  ListEventRegistrationsResponse,
  RegistrationRosterFilter,
  RegistrationRosterSort,
} from "@civfix/shared"
import { useApi, HOST_ROSTER_PAGE_SIZE } from "@civfix/ui/data"

import { useDebouncedValue } from "@/components/console/use-debounced-value"

export interface RosterQueryArgs {
  eventId: string
  filter: RegistrationRosterFilter
  sort: RegistrationRosterSort
  q: string
  ticketTypeId: string | null
  enabled?: boolean
}

export function useConsoleRoster(args: RosterQueryArgs) {
  const api = useApi()
  const q = useDebouncedValue(args.q.trim())
  return useInfiniteQuery<ListEventRegistrationsResponse>({
    queryKey: [
      "host",
      args.eventId,
      "roster",
      "console",
      args.filter,
      args.sort,
      q,
      args.ticketTypeId ?? "all",
    ],
    enabled: args.eventId.length > 0 && (args.enabled ?? true),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listEventRegistrations({
        id: args.eventId,
        limit: HOST_ROSTER_PAGE_SIZE,
        sort: args.sort,
        ...(args.filter !== "all" ? { filter: args.filter } : {}),
        ...(q.length > 0 ? { q } : {}),
        ...(args.ticketTypeId ? { ticketTypeId: args.ticketTypeId } : {}),
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}
