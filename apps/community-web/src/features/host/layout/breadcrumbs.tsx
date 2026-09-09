"use client"

import { ChevronRight } from "lucide-react"
import { useT } from "@civfix/ui/i18n"

import { ConsoleLink } from "./console-link"

export interface Crumb {
  label: string
  href?: string
}

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  const { t } = useT("host-common")
  if (items.length === 0) return null
  return (
    <nav aria-label={t("shell.breadcrumbs")}>
      <ol className="flex flex-wrap items-center gap-1 text-token-12 text-console-ink-3">
        {items.map((item, index) => (
          <li key={`${item.label}:${index}`} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight aria-hidden className="h-3 w-3" /> : null}
            {item.href ? (
              <ConsoleLink
                href={item.href}
                className="rounded-xs font-semibold hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring"
              >
                {item.label}
              </ConsoleLink>
            ) : (
              <span aria-current="page" className="truncate font-semibold text-console-ink-2">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
