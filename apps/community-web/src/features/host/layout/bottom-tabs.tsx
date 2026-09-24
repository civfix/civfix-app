"use client"

import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { ConsoleLink } from "./console-link"
import type { ConsoleNavItem } from "./nav-items"

export interface BottomTabsProps {
  items: readonly ConsoleNavItem[]
  activeId: string | null
}

export function BottomTabs({ items, activeId }: BottomTabsProps) {
  const { t } = useT("host-common")
  return (
    <nav
      aria-label={t("shell.sections")}
      className="fixed inset-x-0 bottom-0 z-console-bottom-tabs flex items-stretch border-t border-console-line bg-console-surface pb-[env(safe-area-inset-bottom)] shadow-console-3 md:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = item.id === activeId
        return (
          <ConsoleLink
            key={item.id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-token-12 font-semibold transition-colors duration-d1 focus-visible:outline-none focus-visible:shadow-console-ring",
              active ? "text-console-ink" : "text-console-ink-3",
            )}
          >
            <Icon aria-hidden className="h-5 w-5" />
            <span className="max-w-full truncate">{item.label}</span>
          </ConsoleLink>
        )
      })}
    </nav>
  )
}
