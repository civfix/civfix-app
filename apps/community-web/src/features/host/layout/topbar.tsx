"use client"

import type { ReactNode } from "react"

export interface ConsoleTopbarProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  breadcrumbs?: ReactNode
  extra?: ReactNode
}

export function ConsoleTopbar({
  title,
  subtitle,
  actions,
  breadcrumbs,
  extra,
}: ConsoleTopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex flex-col gap-token-2 border-b border-console-line bg-console-surface/95 px-token-4 py-token-3 backdrop-blur md:px-token-6">
      {breadcrumbs}
      <div className="flex flex-wrap items-center gap-token-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-token-20 font-bold tracking-snugger text-console-ink">
            {title}
          </h1>
          {subtitle ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-token-2 text-token-13 text-console-ink-3">
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-token-2">{actions}</div> : null}
      </div>
      {extra}
    </header>
  )
}
