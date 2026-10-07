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

import { useConsoleOrg } from "../console-context"
import { HOSTED_WHENS, HostedEventRow, openEventCreator } from "../hosted-events"

export function OrgEventsSection() {
  const { t } = useT("host-org")
  const { t: tp } = useT("host-portfolio")
  const { t: tc } = useT("host-common")
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
          options={HOSTED_WHENS.map((value) => ({ value, label: tp(`list.when_${value}`) }))}
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
              onPress: openEventCreator,
            }}
          />
        }
      >
        <div className="overflow-hidden rounded-md border border-console-line bg-console-surface shadow-console-1">
          {rows.map((row) => (
            <HostedEventRow key={row.id} row={row} />
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
