import { useSearchRecentStore } from "../bodies/search/searchRecentStore"
import { useReportFilterStore } from "../map/filterStore"
import { useAppPromoStore } from "../promo/appPromoStore"
import { useSidebarStore } from "../shell/sidebarStore"
import { useSystemNoticeStore } from "../shell/systemNoticeStore"

/**
 * A persisted store writes its whole saved state back on its next set, so emptying the storage under it
 * holds only once its memory is back at a fresh install's values. Run before `clearPersistentStorage`.
 */
export function resetPersistedStores(): void {
  const filters = useReportFilterStore.getInitialState()
  useReportFilterStore.setState({
    enabled: new Set(filters.enabled),
    eventsEnabled: filters.eventsEnabled,
  })
  useSearchRecentStore.setState({ recent: useSearchRecentStore.getInitialState().recent })
  useSidebarStore.setState({ width: useSidebarStore.getInitialState().width })
  useAppPromoStore.setState({ dismissed: useAppPromoStore.getInitialState().dismissed })
  useSystemNoticeStore.setState({
    dismissedHash: useSystemNoticeStore.getInitialState().dismissedHash,
  })
}
