"use client"

import * as React from "react"
import { useAppPromo, useAppPromoStore } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"

const BANNER_Z_INDEX = 100

/**
 * The portrait counterpart of the landscape <AppPromoCard/>. Both read one promo store, so dismissing here
 * also removes the side card section (visible when a tablet is rotated).
 *
 * BANNER_Z_INDEX sits above the whole AppShell stack (whose layers cap at 71) and below the modal/gate
 * tier (200) and the boot splash (300), so an auth modal still covers it.
 *
 * The banner overlays the map and pushes only the floating map controls down, through the height it
 * publishes to the promo store. The height is measured rather than hardcoded because the subtitle wraps
 * differently across locales.
 */
export function AppDownloadBanner() {
  const { surface, links, dismiss } = useAppPromo()
  const setBannerHeight = useAppPromoStore((s) => s.setBannerHeight)
  const { t } = useT("web-common")
  const ref = React.useRef<HTMLElement | null>(null)

  const visible = surface === "banner"

  // A layout effect runs before paint, so the controls are never painted under the banner for a frame.
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!visible || !el) {
      setBannerHeight(0)
      return
    }
    const publish = () => setBannerHeight(el.getBoundingClientRect().height)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      setBannerHeight(0)
    }
  }, [visible, setBannerHeight])

  if (!visible) return null

  // In portrait `useAppPromo` narrows to exactly one store; the guard keeps a future platform from
  // rendering an empty banner.
  const link = links[0]
  if (!link) return null

  return (
    <aside
      ref={ref}
      aria-label={t("app_promo.card_title")}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: BANNER_Z_INDEX,
        display: "flex",
        alignItems: "center",
        gap: 10,
        // Safe-area padding is a no-op in a normal Safari tab (its viewport already starts below the
        // status bar) but keeps the banner clear of the notch in any edge-to-edge browser chrome.
        padding:
          "calc(8px + env(safe-area-inset-top, 0px)) calc(12px + env(safe-area-inset-right, 0px)) 8px calc(12px + env(safe-area-inset-left, 0px))",
        background: "var(--card)",
        borderBottom: "1px solid var(--ink-5)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("app_promo.dismiss")}
        style={{
          flex: "0 0 auto",
          display: "grid",
          placeItems: "center",
          width: 24,
          height: 24,
          padding: 0,
          border: "none",
          borderRadius: 12,
          background: "transparent",
          color: "var(--ink-3)",
          fontSize: 17,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        {/* Decorative: the button's accessible name comes from aria-label. */}
        <span aria-hidden="true">&#215;</span>
      </button>

      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-display, inherit)",
            fontWeight: 700,
            fontSize: 14,
            lineHeight: 1.2,
            color: "var(--ink)",
          }}
        >
          {t("app_promo.banner_title")}
        </div>
        <div
          style={{
            fontFamily: "var(--font-body, inherit)",
            fontSize: 12,
            lineHeight: 1.3,
            color: "var(--ink-3)",
          }}
        >
          {t("app_promo.banner_subtitle")}
        </div>
      </div>

      <a
        href={link.href}
        target="_blank"
        rel="noopener"
        aria-label={t(link.labelKey)}
        style={{ flex: "0 0 auto", display: "inline-block" }}
      >
        {/* The badge artwork is 40px tall; 32px keeps the banner compact. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image optimization is unavailable under output: "export" */}
        <img
          src={link.badgeSrc}
          alt=""
          aria-hidden="true"
          height={32}
          style={{ height: 32, width: "auto", display: "block" }}
        />
      </a>
    </aside>
  )
}
