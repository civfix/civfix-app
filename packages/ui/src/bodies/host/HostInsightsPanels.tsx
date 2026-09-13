import React, { useState } from "react"
import { View } from "react-native"
import type { EventInsights, EventPhase, EventSlotDTO, InsightsBroadcast } from "@civfix/shared"
import { timeLabel } from "@civfix/shared/datetime"
import { makeThemedStyles } from "../../theme"
import { Text, TextLink } from "../../typography"
import { HeroStat } from "../../primitives/HeroStat"
import { Meter } from "../../primitives/Meter"
import { SectionCard } from "../../primitives/SectionCard"
import { StatTile, StatTileRow } from "../../primitives/StatTile"
import { TrendSparkline } from "../../primitives/TrendSparkline"
import { formatRate, formatStatValue, type StatTileColumns } from "../../primitives/statTileModel"
import { useLocale, useRelativeTime, useT } from "../../i18n"
import { boardHasTimedSlots, currentShifts, slotDisplayOrder, slotWindow } from "../eventSlotsModel"
import { formatMinor } from "./donationFormat"
import { ShiftRow } from "./ShiftRow"
import { TopVolunteersCard } from "./TopVolunteersCard"
import {
  arrivalOffsetLabel,
  arrivalSparkPoints,
  attendanceRate,
  hostHero,
  hostPanels,
  hostStatTiles,
  peakArrival,
  registrationTrendPoints,
  type HostTile,
} from "./hostSurfaceModel"

const TREND_HEIGHT = 56

const MAX_COLLAPSED_SHIFTS = 6

export interface HostInsightsPanelsProps {
  insights: EventInsights
  phase: EventPhase
  columns: StatTileColumns
  slots: readonly EventSlotDTO[]
  now: number
  stale: boolean
}

function useTileText(insights: EventInsights) {
  const { t } = useT("host-mode")
  const { locale } = useLocale()
  return (tile: HostTile): { value: string; hint?: string } => {
    if (tile.key === "hours") {
      return {
        value: t("tiles.hours_value", { hours: tile.value }),
        hint: t("tiles.hours_hint", {
          credited: insights.hours.attendeesCredited,
          attended: tile.total ?? 0,
        }),
      }
    }
    if (tile.key === "donations") {
      return { value: formatMinor(tile.value, "USD", locale) }
    }
    if (tile.key === "returning") {
      return {
        value: formatStatValue(tile.value, locale) ?? String(tile.value),
        hint: t("tiles.returning_hint", { total: tile.total ?? 0 }),
      }
    }
    return { value: formatStatValue(tile.value, locale) ?? String(tile.value) }
  }
}

function HeroPanel({
  insights,
  phase,
  stale,
}: {
  insights: EventInsights
  phase: EventPhase
  stale: boolean
}) {
  const { t } = useT("host-mode")
  const { locale } = useLocale()
  const hero = hostHero(insights, phase)
  const rate = attendanceRate(insights)
  const limitLabel =
    hero.limit === null
      ? t("hero.no_cap")
      : hero.key === "registered"
        ? t("hero.of_capacity", { limit: formatStatValue(hero.limit, locale) ?? hero.limit })
        : t("hero.of_registered", { limit: formatStatValue(hero.limit, locale) ?? hero.limit })
  const fresh =
    phase === "ended"
      ? rate === null
        ? undefined
        : t("hero.rate", { rate: formatRate(rate, locale) ?? "" })
      : phase === "live"
        ? t("hero.as_of", { when: timeLabel(insights.generatedAt, locale) })
        : undefined
  const caption = stale ? t("hero.stale") : fresh

  return (
    <HeroStat
      label={t(`hero.${hero.key}`)}
      value={hero.value}
      limit={hero.limit}
      limitLabel={limitLabel}
      compact
      {...(hero.key === "registered" ? {} : { warnAt: null })}
      {...(caption ? { caption } : {})}
    />
  )
}

function ShiftsPanel({
  slots,
  phase,
  now,
}: {
  slots: readonly EventSlotDTO[]
  phase: EventPhase
  now: number
}) {
  const styles = useStyles()
  const { t } = useT("host-mode")
  const [expanded, setExpanded] = useState(false)
  if (!boardHasTimedSlots(slots)) return null
  const timed = slotDisplayOrder(slots).filter((slot) => slotWindow(slot) !== null)
  if (timed.length === 0) return null
  const running =
    phase === "live" ? new Set(currentShifts(slots, new Date(now)).map((slot) => slot.id)) : null
  const collapsed = timed.length > MAX_COLLAPSED_SHIFTS && !expanded
  const rows = collapsed ? timed.slice(0, MAX_COLLAPSED_SHIFTS) : timed
  return (
    <SectionCard label={t("shifts.section")}>
      <View style={styles.stack}>
        {rows.map((slot) => (
          <ShiftRow key={slot.id} slot={slot} current={running?.has(slot.id) ?? false} />
        ))}
        {timed.length > MAX_COLLAPSED_SHIFTS ? (
          <TextLink standalone variant="label" onPress={() => setExpanded(!expanded)}>
            {expanded ? t("shifts.show_less") : t("shifts.show_all")}
          </TextLink>
        ) : null}
      </View>
    </SectionCard>
  )
}

function SignupsPanel({ insights }: { insights: EventInsights }) {
  const { t } = useT("host-mode")
  const { locale } = useLocale()
  const points = registrationTrendPoints(insights.registrationTrend)
  if (points.length < 2) return null
  const latest = points[points.length - 1]
  const seats = latest?.value ?? 0
  return (
    <SectionCard label={t("signups.title")}>
      <TrendSparkline
        points={points}
        kind="line"
        height={TREND_HEIGHT}
        endLabel={t("signups.end_label", { seats: formatStatValue(seats, locale) ?? seats })}
        accessibilityLabel={t("signups.a11y", {
          days: points.length,
          seats: formatStatValue(seats, locale) ?? seats,
        })}
      />
    </SectionCard>
  )
}

function ByTicketTypePanel({ insights }: { insights: EventInsights }) {
  const styles = useStyles()
  const { t } = useT("host-mode")
  const { locale } = useLocale()
  if (insights.byTicketType.length < 2) return null
  return (
    <SectionCard label={t("by_type.title")}>
      <View style={styles.stack}>
        {insights.byTicketType.map((type) => (
          <View key={type.ticketTypeId} style={styles.typeRow}>
            <View style={styles.typeHead}>
              <Text variant="bodyStrong" numberOfLines={1} style={styles.typeName}>
                {type.name}
              </Text>
              <Text variant="caption">
                {type.capacity === null
                  ? formatStatValue(type.registered, locale)
                  : t("by_type.of", {
                      registered: formatStatValue(type.registered, locale) ?? type.registered,
                      capacity: formatStatValue(type.capacity, locale) ?? type.capacity,
                    })}
              </Text>
            </View>
            {type.capacity === null ? null : (
              <Meter
                value={type.registered}
                max={type.capacity}
                accessibilityLabel={`${type.name}: ${type.registered}/${type.capacity}`}
              />
            )}
            {type.waitlisted > 0 ? (
              <Text variant="caption">{t("by_type.waiting", { count: type.waitlisted })}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </SectionCard>
  )
}

function ArrivalsPanel({ insights }: { insights: EventInsights }) {
  const { t } = useT("host-mode")
  const { locale } = useLocale()
  const points = arrivalSparkPoints(insights.arrivals)
  if (points.length === 0) return null
  const peak = peakArrival(insights.arrivals)
  const endLabel =
    peak === null
      ? undefined
      : t("arrivals.label", {
          seats: formatStatValue(peak.seats, locale) ?? peak.seats,
          offset: arrivalOffsetLabel(peak.offsetMin),
        })
  return (
    <SectionCard label={t("arrivals.title")}>
      <TrendSparkline
        points={points}
        kind="bars"
        height={TREND_HEIGHT}
        accessibilityLabel={t("arrivals.a11y", { buckets: points.length })}
        {...(endLabel ? { endLabel } : {})}
      />
      <Text variant="caption">{t("arrivals.caption")}</Text>
    </SectionCard>
  )
}

function MessagesPanel({ insights }: { insights: EventInsights }) {
  const styles = useStyles()
  const { t } = useT("host-mode")
  const { relative } = useRelativeTime()
  if (insights.broadcasts.length === 0) return null
  const row = (broadcast: InsightsBroadcast) =>
    t("messages.row", {
      sent: broadcast.sent,
      failed: broadcast.failed,
      suppressed: broadcast.suppressed,
    })
  return (
    <SectionCard label={t("messages.title")}>
      <View style={styles.stack}>
        {insights.broadcasts.map((broadcast) => (
          <View key={broadcast.id} style={styles.messageRow}>
            <View style={styles.messageMeta}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {t(`enums:broadcastKind.${broadcast.kind}`)}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {broadcast.finishedAt ? relative(broadcast.finishedAt) : t("messages.pending")}
              </Text>
            </View>
            <Text variant="caption" numberOfLines={1}>
              {row(broadcast)}
            </Text>
          </View>
        ))}
      </View>
    </SectionCard>
  )
}

function MoneyPanel({ insights }: { insights: EventInsights }) {
  const { t } = useT("host-mode")
  const { locale } = useLocale()
  const money = insights.money
  if (money === null) return null
  return (
    <SectionCard label={t("section.money")}>
      <StatTileRow columns={2}>
        <StatTile label={t("money.net")} value={formatMinor(money.netMinor, money.currency, locale)} />
        <StatTile
          label={t("money.donations")}
          value={formatStatValue(money.donationCount, locale)}
          hint={t("money.gross", {
            amount: formatMinor(money.grossMinor, money.currency, locale),
          })}
        />
      </StatTileRow>
    </SectionCard>
  )
}

export function HostInsightsPanels({
  insights,
  phase,
  columns,
  slots,
  now,
  stale,
}: HostInsightsPanelsProps) {
  const styles = useStyles()
  const { t } = useT("host-mode")
  const tileText = useTileText(insights)
  const tiles = hostStatTiles(insights, phase)
  const panels = hostPanels(phase)

  return (
    <View style={styles.stack}>
      <HeroPanel insights={insights} phase={phase} stale={stale} />
      {panels.shifts ? <ShiftsPanel slots={slots} phase={phase} now={now} /> : null}
      {panels.tiles && tiles.length > 0 ? (
        <StatTileRow columns={columns}>
          {tiles.map((tile) => {
            const text = tileText(tile)
            return (
              <StatTile
                key={tile.key}
                label={t(`tiles.${tile.key}`)}
                value={text.value}
                {...(text.hint ? { hint: text.hint } : {})}
                {...(tile.key === "no_shows" && tile.value > 0 ? { tone: "danger" as const } : {})}
              />
            )
          })}
        </StatTileRow>
      ) : null}
      {panels.topVolunteers ? (
        <TopVolunteersCard
          entries={insights.topVolunteers}
          label={t("top_volunteers.title")}
          caption={t("top_volunteers.caption")}
        />
      ) : null}
      {panels.signups ? <SignupsPanel insights={insights} /> : null}
      {panels.byTicketType ? <ByTicketTypePanel insights={insights} /> : null}
      {panels.arrivals ? <ArrivalsPanel insights={insights} /> : null}
      <MoneyPanel insights={insights} />
      {panels.messages ? <MessagesPanel insights={insights} /> : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  stack: {
    gap: t.space["3"],
  },
  typeRow: {
    gap: t.space["1"],
  },
  typeHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: t.space["2"],
  },
  typeName: {
    flex: 1,
    minWidth: 0,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  messageMeta: {
    flex: 1,
    minWidth: 0,
  },
}))
