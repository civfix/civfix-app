"use client"

import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"
import { CountBadge } from "@/components/console/chips/badges"

import { ConsoleLink } from "./console-link"
import type { ConsoleNavItem } from "./nav-items"

export interface ConsoleRailProps {
  items: readonly ConsoleNavItem[]
  activeId: string | null
  compact: boolean
}

export function ConsoleRail({ items, activeId, compact }: ConsoleRailProps) {
  const { t } = useT("host-common")
  return (
    <nav
      aria-label={t("shell.sections")}
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col gap-token-1 overflow-y-auto border-r border-console-line bg-console-surface px-token-2 py-token-4 md:flex",
        compact ? "w-[64px] items-center" : "w-[232px]",
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = item.id === activeId
        return (
          <ConsoleLink
            key={item.id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={compact ? item.label : undefined}
            className={cn(
              "flex min-h-11 items-center gap-token-3 rounded-sm text-token-14 font-semibold transition-colors duration-d1 focus-visible:outline-none focus-visible:shadow-console-ring",
              compact ? "w-11 justify-center px-0" : "px-token-3",
              active
                ? "bg-console-surface-alt text-console-ink"
                : "text-console-ink-2 hover:bg-console-surface-alt/60 hover:text-console-ink",
            )}
          >
            <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
            {compact ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            )}
            {item.badge !== undefined && !compact ? <CountBadge count={item.badge} /> : null}
          </ConsoleLink>
        )
      })}
    </nav>
  )
}
