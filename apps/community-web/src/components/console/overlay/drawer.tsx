"use client"

import { ArrowLeft, ExternalLink, Link2, X } from "lucide-react"
import { useId, useRef } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { ConsoleIconButton } from "../button"
import { useIsNarrow, useMediaQuery, CONSOLE_DRAWER_SHRINK_QUERY } from "../use-media-query"
import { useEscape, useFocusTrap } from "./use-focus-trap"

export type DrawerSize = "sm" | "md" | "lg"

const DRAWER_WIDTH: Record<DrawerSize, number> = { sm: 420, md: 480, lg: 560 }

export interface DrawerProps {
  open: boolean
  onClose: () => void
  size?: DrawerSize
  title: ReactNode
  chips?: ReactNode
  headerExtra?: ReactNode
  footer?: ReactNode
  fullPageHref?: string
  onCopyLink?: () => void
  children: ReactNode
  className?: string
}

export function Drawer({
  open,
  onClose,
  size = "md",
  title,
  chips,
  headerExtra,
  footer,
  fullPageHref,
  onCopyLink,
  children,
  className,
}: DrawerProps) {
  const { t } = useT("host-common")
  const titleId = useId()
  const narrow = useIsNarrow()
  const wide = useMediaQuery(CONSOLE_DRAWER_SHRINK_QUERY)
  const panelRef = useRef<HTMLDivElement>(null)

  const modal = narrow || !wide

  useEscape(open, onClose)
  useFocusTrap(panelRef, open && modal)

  if (!open || typeof document === "undefined") return null

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={modal || undefined}
      aria-labelledby={titleId}
      data-console-drawer
      className={cn(
        "pointer-events-auto flex flex-col bg-console-surface",
        narrow
          ? "fixed inset-0 z-50 animate-in slide-in-from-bottom duration-d3 ease-out"
          : "fixed bottom-0 right-0 top-0 z-50 border-l border-console-line shadow-console-3 animate-in slide-in-from-right duration-d2 ease-out",
        className,
      )}
      style={narrow ? undefined : { width: DRAWER_WIDTH[size], maxWidth: "100vw" }}
    >
      <header className="flex shrink-0 flex-col gap-token-2 border-b border-console-line px-token-4 py-token-3">
        <div className="flex items-center gap-token-2">
          {narrow ? (
            <ConsoleIconButton label={t("action.back")} onClick={onClose}>
              <ArrowLeft aria-hidden className="h-4 w-4" />
            </ConsoleIconButton>
          ) : null}
          <h2
            id={titleId}
            className="min-w-0 flex-1 truncate font-display text-token-16 font-bold text-console-ink"
          >
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-token-1">
            {fullPageHref ? (
              <a
                href={fullPageHref}
                aria-label={t("action.open_full_page")}
                title={t("action.open_full_page")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-console-ink-3 transition-colors duration-d1 hover:bg-console-surface-alt hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring"
              >
                <ExternalLink aria-hidden className="h-4 w-4" />
              </a>
            ) : null}
            {onCopyLink ? (
              <ConsoleIconButton label={t("action.copy_link")} onClick={onCopyLink}>
                <Link2 aria-hidden className="h-4 w-4" />
              </ConsoleIconButton>
            ) : null}
            {!narrow ? (
              <ConsoleIconButton label={t("action.close")} onClick={onClose}>
                <X aria-hidden className="h-4 w-4" />
              </ConsoleIconButton>
            ) : null}
          </div>
        </div>
        {chips ? <div className="flex flex-wrap items-center gap-1">{chips}</div> : null}
        {headerExtra}
      </header>
      <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? (
        <footer className="shrink-0 border-t border-console-line bg-console-tint px-token-4 py-token-3">
          {footer}
        </footer>
      ) : null}
    </div>
  )

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50">
      {modal ? (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={onClose}
          className="pointer-events-auto absolute inset-0 bg-console-scrim animate-in fade-in duration-d2"
        />
      ) : null}
      {panel}
    </div>,
    document.body,
  )
}
