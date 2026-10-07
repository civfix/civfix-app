"use client"

import type { HostedEventDTO, HostedEventsWhen } from "@civfix/shared"
import { useT } from "@civfix/ui/i18n"

import { Chip } from "@/components/console/chips/chip"
import { QRow } from "@/components/console/qrow"

import { useConsoleNavigation } from "./console-context"
import { useConsoleFormat } from "./format"

export const HOSTED_WHENS: readonly HostedEventsWhen[] = ["upcoming", "past", "all"]

/** Event creation lives in the public app, outside the console's client-side router. */
const EVENT_CREATE_PATH = "/events/"

export function isHostedWhen(value: string | undefined): value is HostedEventsWhen {
  return value !== undefined && (HOSTED_WHENS as readonly string[]).includes(value)
}

export function openEventCreator(): void {
  window.location.assign(EVENT_CREATE_PATH)
}

export interface HostedEventRowProps {
  row: HostedEventDTO
  showOrg?: boolean
  showWaitlist?: boolean
}

export function HostedEventRow({ row, showOrg = false, showWaitlist = false }: HostedEventRowProps) {
  const { t } = useT("host-portfolio")
  const format = useConsoleFormat()
  const { go } = useConsoleNavigation()
  return (
    <QRow
      title={row.title}
      pressLabel={t("list.open", { title: row.title })}
      ident={row.referenceCode ?? undefined}
      sub={
        <span className="flex flex-wrap items-center gap-token-2">
          <span>{format.whenLabel(row.startsAt, row.timezone ?? undefined)}</span>
          {showOrg && row.orgName ? <span>{row.orgName}</span> : null}
          <span>
            {t("list.counts", {
              registered: format.number(row.registeredCount),
              checked: format.number(row.checkedInCount),
            })}
          </span>
          {showWaitlist && row.waitlistCount > 0 ? (
            <span>{t("list.waitlist", { count: row.waitlistCount })}</span>
          ) : null}
        </span>
      }
      chips={
        <>
          <Chip kind="event-status" value={row.status} size="sm" />
          <Chip kind="event-visibility" value={row.visibility} size="sm" />
        </>
      }
      onPress={() => go({ kind: "event", eventId: row.id, section: "overview" })}
    />
  )
}
