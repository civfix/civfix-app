"use client"

import { useState } from "react"
import { useMyHostedEvents, hostedEventRows } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"
import { hrefForRoute } from "@/components/console/route"
import type { EventSection } from "@/components/console/route"
import { LoadingState } from "@/components/console/states"

import { ConsoleLink } from "./console-link"
import { SwitcherOverlay } from "./switcher-overlay"

export interface EventSwitcherProps {
  eventId: string
  section: EventSection | null
  className?: string
}

export function EventSwitcher({ eventId, section, className }: EventSwitcherProps) {
  const { t } = useT("host-event")
  const [open, setOpen] = useState(false)
  const events = useMyHostedEvents("upcoming", null)
  const rows = hostedEventRows(events.data?.pages)

  const hrefFor = (id: string) =>
    section === "broadcasts"
      ? hrefForRoute({ kind: "broadcasts", eventId: id })
      : hrefForRoute({ kind: "event", eventId: id, section: section ?? "overview" })

  return (
    <SwitcherOverlay
      open={open}
      setOpen={setOpen}
      label={t("switcher.label")}
      className={className}
    >
      {events.isPending ? (
        <LoadingState count={3} />
      ) : rows.length === 0 ? (
        <p className="text-token-13 text-console-ink-3">{t("switcher.empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li key={row.id}>
              <ConsoleLink
                href={hrefFor(row.id)}
                aria-current={row.id === eventId ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 flex-col justify-center rounded-xs px-token-2 py-1 text-token-13 transition-colors duration-d1 hover:bg-console-surface-alt focus-visible:outline-none focus-visible:shadow-console-ring",
                  row.id === eventId ? "text-console-ink" : "text-console-ink-2",
                )}
              >
                <span className="truncate font-semibold">{row.title}</span>
                <span className="truncate text-token-12 text-console-ink-3">
                  {row.orgName ?? t("switcher.personal")}
                </span>
              </ConsoleLink>
            </li>
          ))}
        </ul>
      )}
    </SwitcherOverlay>
  )
}
