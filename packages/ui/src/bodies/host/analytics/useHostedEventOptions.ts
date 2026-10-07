import { useMemo } from "react"
import { hostedEventRows, useMyHostedEvents } from "../../../data/hooks/host"
import { pickerOptions, type AnalyticsPickerOption } from "../analyticsModel"

export interface HostedEventOptions {
  options: AnalyticsPickerOption[]
  moreEvents: boolean
  loadingMoreEvents: boolean
  loadMoreEvents: () => void
}

export function useHostedEventOptions(): HostedEventOptions {
  const upcoming = useMyHostedEvents("upcoming", null)
  const past = useMyHostedEvents("past", null)
  const options = useMemo(
    () => pickerOptions(hostedEventRows(upcoming.data?.pages), hostedEventRows(past.data?.pages)),
    [upcoming.data, past.data],
  )

  const moreEvents = upcoming.hasNextPage || past.hasNextPage
  const loadingMoreEvents = upcoming.isFetchingNextPage || past.isFetchingNextPage
  const loadMoreEvents = () => {
    if (upcoming.hasNextPage && !upcoming.isFetchingNextPage) void upcoming.fetchNextPage()
    if (past.hasNextPage && !past.isFetchingNextPage) void past.fetchNextPage()
  }

  return { options, moreEvents, loadingMoreEvents, loadMoreEvents }
}
