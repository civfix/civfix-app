import { useCallback } from "react"

export interface ListPagingState {
  hasNextPage: boolean
  isFetchingNextPage: boolean
}

export interface ListPagingQuery extends ListPagingState {
  fetchNextPage: () => Promise<unknown>
}

/**
 * A filter only sees loaded pages, so while one is on the end of the list is not a reason to load more:
 * onEndReached would fire repeatedly against a short filtered list and pull every page.
 */
export function shouldLoadMoreOnEndReached(paging: ListPagingState, filtering: boolean): boolean {
  if (filtering) return false
  return paging.hasNextPage && !paging.isFetchingNextPage
}

export function useListEndReached(query: ListPagingQuery, filtering = false): () => void {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  return useCallback(() => {
    if (shouldLoadMoreOnEndReached({ hasNextPage, isFetchingNextPage }, filtering)) void fetchNextPage()
  }, [filtering, hasNextPage, isFetchingNextPage, fetchNextPage])
}
