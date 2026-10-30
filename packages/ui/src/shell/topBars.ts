/**
 * The web app's fixed top bars, stacked: the system notice, then (portrait only) the app download banner
 * under it. Each publishes its own measured height, 0 when it is not shown; what sits under them clears the
 * sum.
 */
import { useAppPromoStore } from "../promo/appPromoStore"
import { useSystemNoticeStore } from "./systemNoticeStore"

export function topBarsHeight(): number {
  return useSystemNoticeStore.getState().height + useAppPromoStore.getState().bannerHeight
}

export function useTopBarsHeight(): number {
  const notice = useSystemNoticeStore((s) => s.height)
  const download = useAppPromoStore((s) => s.bannerHeight)
  return notice + download
}
