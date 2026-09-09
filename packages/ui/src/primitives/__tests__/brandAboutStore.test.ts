import { beforeEach, describe, expect, it, vi } from "vitest"
import { openBrandAbout, setBrandAboutPresenter, useBrandAboutStore } from "../brandAboutStore"

beforeEach(() => {
  setBrandAboutPresenter(null)
  useBrandAboutStore.setState({ open: false })
})

describe("openBrandAbout", () => {
  it("calls the host presenter and leaves the store's open flag alone", () => {
    const present = vi.fn()
    setBrandAboutPresenter(present)

    openBrandAbout()

    expect(present).toHaveBeenCalledTimes(1)
    expect(useBrandAboutStore.getState().open).toBe(false)
  })

  it("opens the store when NO host presenter is registered", () => {
    openBrandAbout()

    expect(useBrandAboutStore.getState().open).toBe(true)
  })

  it("hands the request back to the store once the presenter is cleared", () => {
    const present = vi.fn()
    setBrandAboutPresenter(present)
    openBrandAbout()

    setBrandAboutPresenter(null)
    openBrandAbout()

    expect(present).toHaveBeenCalledTimes(1)
    expect(useBrandAboutStore.getState().open).toBe(true)
  })

  it("routes every later request to the presenter that replaced an earlier one", () => {
    const first = vi.fn()
    const second = vi.fn()
    setBrandAboutPresenter(first)
    setBrandAboutPresenter(second)

    openBrandAbout()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe("useBrandAboutStore", () => {
  it("closes again through setOpen, so the web overlay can dismiss", () => {
    openBrandAbout()
    expect(useBrandAboutStore.getState().open).toBe(true)

    useBrandAboutStore.getState().setOpen(false)
    expect(useBrandAboutStore.getState().open).toBe(false)
  })
})
