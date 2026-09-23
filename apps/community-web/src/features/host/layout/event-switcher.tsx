"use client"

import { useState } from "react"
import { ChevronsUpDown } from "lucide-react"
import { useMyHostedEvents, hostedEventRows } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"
import { hrefForRoute } from "@/components/console/route"
import type { EventSection } from "@/components/console/route"
import { Overlay } from "@/components/console/overlay/overlay"
import { LoadingState } from "@/components/console/states"

import { ConsoleLink } from "./console-link"

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
    <Overlay
      open={open}
      onClose={() => setOpen(false)}
      align="end"
      width={320}
      label={t("switcher.label")}
      trigger={
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-sm border border-console-line bg-console-surface px-token-3 text-token-13 font-semibold text-console-ink-2 transition-colors duration-d1 hover:bg-console-surface-alt hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring",
            className,
          )}
        >
          {t("switcher.label")}
          <ChevronsUpDown aria-hidden className="h-3.5 w-3.5" />
        </button>
      }
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
    </Overlay>
  )
}
