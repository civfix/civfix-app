"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import type {
  ListEventRegistrationsResponse,
  RegistrationRosterFilter,
  RegistrationRosterSort,
} from "@civfix/shared"
import { useApi, useDebouncedValue, HOST_ROSTER_PAGE_SIZE } from "@civfix/ui/data"

import { consoleKeys } from "../console-keys"

const CONSOLE_SEARCH_DEBOUNCE_MS = 300

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
  const q = useDebouncedValue(args.q.trim(), CONSOLE_SEARCH_DEBOUNCE_MS)
  return useInfiniteQuery<ListEventRegistrationsResponse>({
    queryKey: consoleKeys.roster(args.eventId, args.filter, args.sort, q, args.ticketTypeId),
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
