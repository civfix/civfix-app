"use client"

import * as React from "react"
import { useAppPromo, useAppPromoStore } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"

/**
 * The fixed top "download the app" banner, shown to phones/tablets in PORTRAIT (see
 * docs/superpowers/specs/2026-07-18-web-app-download-promo-design.md). The landscape/desktop counterpart
 * is <AppPromoCard/>, which renders at the bottom of the home side card from inside @civfix/ui.
 *
 * All of the "should this show, and which store" logic lives in the shared, unit-tested `useAppPromo()`:
 * web-only, portrait, a detected store platform, not dismissed, not an installed PWA. Both surfaces read
 * ONE store, so dismissing here also removes the side card section (visible when a tablet is rotated).
 *
 * Layering: z-index 100 sits above the whole AppShell stack (whose layers cap at 71) and below the
 * modal/gate tier (200) and the boot splash (300), so an auth modal still covers it.
 *
 * The banner OVERLAYS the full-bleed map rather than displacing it, and pushes only the floating map
 * controls down: it publishes its measured height into the shared promo store, which web-map-controls
 * folds into `MapControls topInset`. The height is measured (not hardcoded) because the subtitle wraps
 * at different heights across locales - the German string is markedly longer than the English one.
 */
export function AppDownloadBanner() {
  const { surface, links, dismiss } = useAppPromo()
  const setBannerHeight = useAppPromoStore((s) => s.setBannerHeight)
  const { t } = useT("web-common")
  const ref = React.useRef<HTMLElement | null>(null)

  const visible = surface === "banner"

  // Publish the live height so the map controls clear the banner. A layout effect (not a plain effect)
  // runs before paint, so the controls are never painted underneath the banner for a frame. ResizeObserver
  // keeps it correct across rotation, font swaps, and locale changes; unmount resets it to 0 so the
  // controls slide back up.
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

  // In portrait `useAppPromo` always narrows to exactly one store (Apple OR Google); `other` never
  // reaches this surface. Guard anyway so a future platform can never render an empty banner.
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
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 10,
        // Safe-area padding is a no-op in a normal Safari tab (its viewport already starts below the
        // status bar) but keeps the banner clear of the notch in any edge-to-edge browser chrome.
        padding:
          "calc(8px + env(safe-area-inset-top, 0px)) calc(12px + env(safe-area-inset-right, 0px)) 8px calc(12px + env(safe-area-inset-left, 0px))",
        background: "var(--card, #fff)",
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
        {/* A literal multiplication sign, not the letter x - the button's accessible name comes from
            aria-label, so this glyph is decorative. */}
        <span aria-hidden="true">&#215;</span>
      </button>

      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-display, inherit)",
            fontWeight: 700,
            fontSize: 14,
            lineHeight: 1.2,
            color: "var(--ink, #1a1714)",
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
        {/* Intrinsic badge artwork is 40px tall; rendered at 32px to keep the banner compact. A tiny
            static local SVG - next/image is disabled under output:"export" and would only add overhead. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
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
