/**
 * The partition between persisted and ephemeral state: `dismissed` must survive a reload, the heights
 * must not (a stale height would offset the map controls on a load where no banner renders).
 */
import { beforeEach, describe, expect, it } from "vitest"
import { useAppPromoStore } from "../appPromoStore"

beforeEach(() => {
  useAppPromoStore.setState({ dismissed: false, bannerHeight: 0, cardHeight: 0 })
})

describe("appPromoStore: defaults", () => {
  it("starts undismissed with no surface heights", () => {
    const state = useAppPromoStore.getState()
    expect(state.dismissed).toBe(false)
    expect(state.bannerHeight).toBe(0)
    expect(state.cardHeight).toBe(0)
  })
})

describe("appPromoStore: dismiss", () => {
  it("dismiss() marks the promo dismissed", () => {
    useAppPromoStore.getState().dismiss()
    expect(useAppPromoStore.getState().dismissed).toBe(true)
  })

  it("dismiss() is idempotent", () => {
    useAppPromoStore.getState().dismiss()
    useAppPromoStore.getState().dismiss()
    expect(useAppPromoStore.getState().dismissed).toBe(true)
  })

  it("dismiss() also zeroes the banner height so the map controls slide back up", () => {
    useAppPromoStore.getState().setBannerHeight(64)
    useAppPromoStore.getState().dismiss()
    expect(useAppPromoStore.getState().bannerHeight).toBe(0)
  })

  it("dismiss() also zeroes the card height so the sidebar reclaims its bottom padding", () => {
    useAppPromoStore.getState().setCardHeight(96)
    useAppPromoStore.getState().dismiss()
    expect(useAppPromoStore.getState().cardHeight).toBe(0)
  })
})

describe("appPromoStore: cardHeight", () => {
  it("setCardHeight records the measured height", () => {
    useAppPromoStore.getState().setCardHeight(96)
    expect(useAppPromoStore.getState().cardHeight).toBe(96)
  })

  it("setCardHeight rounds sub-pixel measurements", () => {
    useAppPromoStore.getState().setCardHeight(95.6)
    expect(useAppPromoStore.getState().cardHeight).toBe(96)
  })

  it("setCardHeight never goes negative (it feeds scroll bottom padding)", () => {
    useAppPromoStore.getState().setCardHeight(-10)
    expect(useAppPromoStore.getState().cardHeight).toBe(0)
  })

  it("tracks banner and card heights independently", () => {
    useAppPromoStore.getState().setBannerHeight(64)
    useAppPromoStore.getState().setCardHeight(96)
    expect(useAppPromoStore.getState().bannerHeight).toBe(64)
    expect(useAppPromoStore.getState().cardHeight).toBe(96)
  })
})

describe("appPromoStore: bannerHeight", () => {
  it("setBannerHeight records the measured height", () => {
    useAppPromoStore.getState().setBannerHeight(64)
    expect(useAppPromoStore.getState().bannerHeight).toBe(64)
  })

  it("setBannerHeight rounds sub-pixel measurements", () => {
    useAppPromoStore.getState().setBannerHeight(63.4)
    expect(useAppPromoStore.getState().bannerHeight).toBe(63)
  })

  it("setBannerHeight never goes negative (it feeds MapControls topInset)", () => {
    useAppPromoStore.getState().setBannerHeight(-10)
    expect(useAppPromoStore.getState().bannerHeight).toBe(0)
  })
})

describe("appPromoStore: persistence partition", () => {
  it("persists ONLY the dismissed flag, never the ephemeral surface heights", () => {
    useAppPromoStore.getState().setBannerHeight(64)
    useAppPromoStore.getState().setCardHeight(96)
    useAppPromoStore.getState().dismiss()

    const partialize = useAppPromoStore.persist.getOptions().partialize
    const persisted = partialize?.(useAppPromoStore.getState())

    expect(persisted).toEqual({ dismissed: true })
  })

  it("persists under the agreed storage key", () => {
    expect(useAppPromoStore.persist.getOptions().name).toBe("civfix.app-promo-dismissed")
  })
})
