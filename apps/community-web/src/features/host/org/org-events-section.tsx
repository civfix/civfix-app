"use client"

import { useState } from "react"
import { CalendarDays } from "lucide-react"
import type { HostedEventsWhen } from "@civfix/shared"
import { useMyHostedEvents, hostedEventRows } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { useGate } from "@/components/console/query-state"
import { ConsoleButton } from "@/components/console/button"
import { EmptyState, StateGate } from "@/components/console/states"
import { SegmentedControl } from "@/components/console/forms/segmented-control"
import { Chip } from "@/components/console/chips/chip"
import { QRow } from "@/components/console/qrow"

import { useConsoleNavigation, useConsoleOrg } from "../console-context"
import { useConsoleFormat } from "../format"

const WHENS: readonly HostedEventsWhen[] = ["upcoming", "past", "all"]

export function OrgEventsSection() {
  const { t } = useT("host-org")
  const { t: tp } = useT("host-portfolio")
  const { t: tc } = useT("host-common")
  const format = useConsoleFormat()
  const { go } = useConsoleNavigation()
  const { orgId } = useConsoleOrg()
  const [when, setWhen] = useState<HostedEventsWhen>("upcoming")

  const events = useMyHostedEvents(when, orgId)
  const gate = useGate(events)
  const rows = hostedEventRows(events.data?.pages)

  return (
    <section aria-labelledby="org-events" className="flex flex-col gap-token-3">
      <div className="flex flex-wrap items-center justify-between gap-token-3">
        <div>
          <h2 id="org-events" className="font-display text-token-16 font-bold text-console-ink">
            {t("events.title", { defaultValue: "Events" })}
          </h2>
          <p className="text-token-12 text-console-ink-3">
            {t("events.subtitle", {
              defaultValue:
                "Events linked to this organization. Link one from the event's Settings under Organization.",
            })}
          </p>
        </div>
        <SegmentedControl
          size="sm"
          label={tp("list.when")}
          value={when}
          onChange={setWhen}
          options={WHENS.map((value) => ({ value, label: tp(`list.when_${value}`) }))}
        />
      </div>

      <StateGate
        {...gate}
        onRetry={() => void events.refetch()}
        empty={rows.length === 0}
        emptyState={
          <EmptyState
            icon={CalendarDays}
            tone="sky"
            title={t("events.empty_title", { defaultValue: "No events linked yet" })}
            body={t("events.empty_body", {
              defaultValue:
                "Create an event, then open its Settings and pick this organization under Organization. Linked events show the organization's name and verification badge.",
            })}
            cta={{
              label: tp("list.create"),
              onPress: () => window.location.assign("/events/"),
            }}
          />
        }
      >
        <div className="overflow-hidden rounded-md border border-console-line bg-console-surface shadow-console-1">
          {rows.map((row) => (
            <QRow
              key={row.id}
              title={row.title}
              pressLabel={tp("list.open", { title: row.title })}
              ident={row.referenceCode ?? undefined}
              sub={
                <span className="flex flex-wrap items-center gap-token-2">
                  <span>{format.whenLabel(row.startsAt, row.timezone ?? undefined)}</span>
                  <span>
                    {tp("list.counts", {
                      registered: format.number(row.registeredCount),
                      checked: format.number(row.checkedInCount),
                    })}
                  </span>
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
          ))}
        </div>
        {events.hasNextPage ? (
          <div className="flex justify-center">
            <ConsoleButton
              variant="outline"
              size="sm"
              disabled={events.isFetchingNextPage}
              onClick={() => void events.fetchNextPage()}
            >
              {events.isFetchingNextPage ? tc("action.loading") : tc("action.load_more")}
            </ConsoleButton>
          </div>
        ) : null}
      </StateGate>
    </section>
  )
}
