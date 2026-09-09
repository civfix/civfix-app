"use client"

import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"
import { useConsoleRailMode } from "@/components/console/use-media-query"

import { useConsoleNavigation } from "../console-context"
import { BottomTabs } from "./bottom-tabs"
import { ConsoleRail } from "./rail"
import { ConsoleTopbar } from "./topbar"
import type { ConsoleNavItem } from "./nav-items"

export interface ConsoleShellProps {
  navItems: readonly ConsoleNavItem[]
  bottomTabs: readonly ConsoleNavItem[]
  activeId: string | null
  title: string
  subtitle?: ReactNode
  headerActions?: ReactNode
  headerExtra?: ReactNode
  breadcrumbs?: ReactNode
  children: ReactNode
}

export function ConsoleShell({
  navItems,
  bottomTabs,
  activeId,
  title,
  subtitle,
  headerActions,
  headerExtra,
  breadcrumbs,
  children,
}: ConsoleShellProps) {
  const { t } = useT("host-common")
  const railMode = useConsoleRailMode()
  const { pathname } = useConsoleNavigation()
  const contentRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    contentRef.current?.focus()
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])

  return (
    <div className="flex min-h-screen w-full flex-col bg-console-canvas text-console-ink">
      <a
        href="#console-content"
        className="sr-only left-token-3 top-token-3 z-[80] rounded-sm bg-console-surface px-token-3 py-token-2 text-token-13 font-semibold text-console-ink shadow-console-3 focus:not-sr-only focus:absolute focus-visible:outline-none focus-visible:shadow-console-ring"
      >
        {t("shell.skip_to_content")}
      </a>
      <div className="flex min-h-screen w-full">
        {railMode !== "bottom-tabs" ? (
          <ConsoleRail items={navItems} activeId={activeId} compact={railMode === "icon"} />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <ConsoleTopbar
            title={title}
            subtitle={subtitle}
            actions={headerActions}
            breadcrumbs={breadcrumbs}
            extra={headerExtra}
          />
          <main
            id="console-content"
            ref={contentRef}
            tabIndex={-1}
            data-cf-skip-target
            className={cn(
              "min-w-0 flex-1 px-token-4 py-token-5 focus-visible:outline-none md:px-token-6",
              railMode === "bottom-tabs" && "pb-[76px]",
            )}
          >
            {children}
          </main>
        </div>
      </div>
      {railMode === "bottom-tabs" ? <BottomTabs items={bottomTabs} activeId={activeId} /> : null}
    </div>
  )
}
