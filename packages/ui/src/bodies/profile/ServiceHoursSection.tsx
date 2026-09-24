import React, { useCallback, useMemo } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { JurisdictionHours, OrgHoursDTO, VolunteerHoursEntryDTO } from "@civfix/shared"
import { eventChip } from "@civfix/shared/datetime"
import { makeThemedStyles, useTheme, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { Avatar, EmptyState, MetaDot, SkeletonBlock, SkeletonGroup } from "../../primitives"
import { DateTile } from "../../primitives/DateBadge"
import { useAuthState, useMyHours, useMyHoursEntries, usePublicHoursEntries } from "../../data"
import { useNavStore } from "../../nav"
import { useLocale, useT } from "../../i18n"
import { formatHoursDisplay } from "../formatHours"
import { SectionEyebrow } from "./SectionHeadings"
import { useSectionStyles } from "./sectionStyles"
import { ServiceHoursCertificateCard } from "./ServiceHoursCertificateCard"

const MAX_JURISDICTION_CHIPS = 3
const MAX_ORGANIZATION_CHIPS = 3
const SKELETON_ROWS = [0, 1, 2]
const SKELETON_CHIP_SIZE = 38
const SKELETON_CHIP_RADIUS = 9
const SKELETON_LINE_RADIUS = 7

export interface ServiceHoursSectionProps {
  variant: "own" | "public"
  userId?: string
  totalHours?: number
}

export function ServiceHoursSection({ variant, userId, totalHours }: ServiceHoursSectionProps) {
  return variant === "own" ? (
    <OwnServiceHours totalHours={totalHours} />
  ) : (
    <PublicServiceHours userId={userId} totalHours={totalHours} />
  )
}

function OwnServiceHours({ totalHours }: { totalHours?: number }) {
  const { t } = useT("volunteer-hours")
  const hoursQuery = useMyHours()
  const entriesQuery = useMyHoursEntries()

  const pages = entriesQuery.data?.pages
  const firstPage = pages?.[0]
  const total = hoursQuery.data?.hours.totalHours ?? firstPage?.totalHours ?? totalHours ?? 0
  const byJurisdiction = hoursQuery.data?.hours.byJurisdiction ?? []
  const byOrganization = hoursQuery.data?.hours.byOrganization ?? []
  const items = useMemo(() => (pages ?? []).flatMap((page) => page.items), [pages])

  const onLoadMore = useCallback(() => {
    if (entriesQuery.hasNextPage && !entriesQuery.isFetchingNextPage) void entriesQuery.fetchNextPage()
  }, [entriesQuery])

  return (
    <>
      <HoursTotalCard total={total} byJurisdiction={byJurisdiction} byOrganization={byOrganization}>
        <ServiceHoursCertificateCard totalHours={total} />
        <VisibilityIndicator />
      </HoursTotalCard>
      <HoursLedger
        items={items}
        isLoading={entriesQuery.isLoading}
        isError={entriesQuery.isError}
        emptyBody={t("ledger.empty_body")}
        hasNextPage={!!entriesQuery.hasNextPage}
        isFetchingNextPage={entriesQuery.isFetchingNextPage}
        onLoadMore={onLoadMore}
      />
    </>
  )
}

function PublicServiceHours({ userId, totalHours }: { userId?: string; totalHours?: number }) {
  const th = useTheme()
  const { t } = useT("volunteer-hours")
  const query = usePublicHoursEntries(userId)

  const pages = query.data?.pages
  const firstPage = pages?.[0]
  const items = useMemo(() => (pages ?? []).flatMap((page) => page.items), [pages])

  const onLoadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
  }, [query])

  if (query.isError) {
    return (
      <EmptyState
        variant="detail"
        tone="neutral"
        icon={iconMap.CloudOff}
        iconColor={th.colors.textSubtle}
        iconSize={30}
        title={t("ledger.error_title")}
        body={t("ledger.error_body")}
      />
    )
  }

  if (firstPage && !firstPage.visible) {
    return (
      <EmptyState
        variant="detail"
        tone="moss"
        icon={iconMap.Award}
        title={t("ledger.empty_title")}
        body={t("ledger.public_empty")}
      />
    )
  }

  const total = firstPage?.totalHours ?? totalHours ?? 0

  const itemisationWithheld =
    !!firstPage && !query.isLoading && total > 0 && items.length === 0 && !query.hasNextPage

  return (
    <>
      <HoursTotalCard
        total={total}
        byJurisdiction={firstPage?.byJurisdiction ?? []}
        byOrganization={firstPage?.byOrganization ?? []}
      />
      {itemisationWithheld ? (
        <>
          <SectionEyebrow>{t("ledger.eyebrow")}</SectionEyebrow>
          <EmptyState
            variant="detail"
            tone="neutral"
            icon={iconMap.Info}
            iconColor={th.colors.textSubtle}
            iconSize={30}
            title={t("ledger.withheld_title")}
            body={t("ledger.withheld_body")}
          />
        </>
      ) : (
        <HoursLedger
          items={items}
          isLoading={query.isLoading}
          isError={false}
          emptyBody={t("ledger.public_empty")}
          hasNextPage={!!query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={onLoadMore}
        />
      )}
    </>
  )
}

function HoursTotalCard({
  total,
  byJurisdiction,
  byOrganization,
  children,
}: {
  total: number
  byJurisdiction: readonly JurisdictionHours[]
  byOrganization: readonly OrgHoursDTO[]
  children?: React.ReactNode
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("volunteer-hours")
  const { locale } = useLocale()
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.tile}>
          <Icon icon={iconMap.Award} size={20} color={th.colors.brand.bloom} />
        </View>
        <View style={styles.totalCol}>
          <Text style={styles.totalValue}>
            {t("total.value", { hours: formatHoursDisplay(total, locale) })}
          </Text>
          <Text style={styles.totalLabel}>{t("total.label")}</Text>
        </View>
      </View>
      <JurisdictionChips items={byJurisdiction} />
      <OrganizationChips items={byOrganization} />
      {children}
    </View>
  )
}

function JurisdictionChips({ items }: { items: readonly JurisdictionHours[] }) {
  const styles = useStyles()
  const { t } = useT("volunteer-hours")
  const { locale } = useLocale()
  if (items.length === 0) return null
  const shown = items.slice(0, MAX_JURISDICTION_CHIPS)
  const extra = items.length - shown.length
  return (
    <View style={styles.chipRow}>
      {shown.map((entry) => (
        <Pressable
          key={entry.geoid}
          onPress={() => useNavStore.getState().push({ kind: "leaderboard", geoid: entry.geoid })}
          accessibilityRole="button"
          accessibilityLabel={t("total.chip_a11y", { name: entry.name ?? entry.geoid })}
          hitSlop={{ top: 9, bottom: 9 }}
          {...focusRingProps}
          style={({ pressed }) => [styles.chip, pressed ? styles.pressedDim : null]}
        >
          <Text style={styles.chipText} numberOfLines={1}>
            {t("total.chip", {
              name: entry.name ?? entry.geoid,
              hours: formatHoursDisplay(entry.hours, locale),
            })}
          </Text>
        </Pressable>
      ))}
      {extra > 0 ? (
        <View style={styles.chip}>
          <Text style={styles.chipText}>{t("total.chip_more", { count: extra })}</Text>
        </View>
      ) : null}
    </View>
  )
}

function OrganizationChips({ items }: { items: readonly OrgHoursDTO[] }) {
  const styles = useStyles()
  const { t } = useT("volunteer-hours")
  const { locale } = useLocale()
  if (items.length === 0) return null
  const shown = items.slice(0, MAX_ORGANIZATION_CHIPS)
  const extra = items.length - shown.length
  return (
    <View style={styles.chipRow}>
      {shown.map(({ organization, hours }) => (
        <Pressable
          key={organization.id}
          onPress={() => useNavStore.getState().push({ kind: "org", slug: organization.slug })}
          accessibilityRole="button"
          accessibilityLabel={t("total.org_chip_a11y", { name: organization.name })}
          hitSlop={{ top: 9, bottom: 9 }}
          {...focusRingProps}
          style={({ pressed }) => [styles.chip, styles.orgChip, pressed ? styles.pressedDim : null]}
        >
          <Avatar
            name={organization.name}
            seed={organization.id}
            photoUrl={organization.logoUrl ?? null}
            size={16}
          />
          <Text style={[styles.chipText, styles.orgChipText]} numberOfLines={1}>
            {t("total.org_chip", {
              name: organization.name,
              hours: formatHoursDisplay(hours, locale),
            })}
          </Text>
        </Pressable>
      ))}
      {extra > 0 ? (
        <View style={styles.chip}>
          <Text style={styles.chipText}>{t("total.chip_more", { count: extra })}</Text>
        </View>
      ) : null}
    </View>
  )
}

function VisibilityIndicator() {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("volunteer-hours")
  const { user } = useAuthState()
  const choice = user?.showVolunteerHours
  const state = choice === true ? "public" : choice === false ? "private" : "default"
  const label = t(`visibility.${state}`)
  return (
    <Pressable
      onPress={() => useNavStore.getState().push({ kind: "settings-privacy" })}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${t("visibility.a11y")}`}
      hitSlop={{ top: 12, bottom: 12, right: 12 }}
      {...focusRingProps}
      style={({ pressed }) => [styles.visibility, pressed ? styles.pressedDim : null]}
    >
      <Icon
        icon={state === "public" ? iconMap.Globe : state === "private" ? iconMap.Lock : iconMap.Users}
        size={13}
        color={th.colors.textSubtle}
      />
      <Text style={styles.visibilityText}>{label}</Text>
    </Pressable>
  )
}

function HoursLedger({
  items,
  isLoading,
  isError,
  emptyBody,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  items: readonly VolunteerHoursEntryDTO[]
  isLoading: boolean
  isError: boolean
  emptyBody: string
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}) {
  const sectionStyles = useSectionStyles()
  const th = useTheme()
  const { t } = useT("volunteer-hours")
  return (
    <>
      <SectionEyebrow>{t("ledger.eyebrow")}</SectionEyebrow>
      {isError ? (
        <EmptyState
          variant="detail"
          tone="neutral"
          icon={iconMap.CloudOff}
          iconColor={th.colors.textSubtle}
          iconSize={30}
          title={t("ledger.error_title")}
          body={t("ledger.error_body")}
        />
      ) : isLoading ? (
        <SkeletonGroup>
          {SKELETON_ROWS.map((i) => (
            <LedgerRowSkeleton key={i} />
          ))}
        </SkeletonGroup>
      ) : items.length === 0 ? (
        <EmptyState
          variant="detail"
          tone="moss"
          icon={iconMap.Award}
          title={t("ledger.empty_title")}
          body={emptyBody}
        />
      ) : (
        <>
          <View>
            {items.map((entry) => (
              <LedgerRow key={entry.id} entry={entry} />
            ))}
          </View>
          {hasNextPage ? (
            <Pressable
              onPress={onLoadMore}
              disabled={isFetchingNextPage}
              accessibilityRole="button"
              accessibilityLabel={t("ledger.load_more_a11y")}
              accessibilityState={{ disabled: isFetchingNextPage, busy: isFetchingNextPage }}
              {...focusRingProps}
              style={({ pressed }) => [
                sectionStyles.loadMore,
                pressed ? sectionStyles.loadMorePressed : null,
              ]}
            >
              <Text style={sectionStyles.loadMoreText}>
                {isFetchingNextPage ? t("ledger.loading_more") : t("ledger.load_more")}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </>
  )
}

function LedgerRow({ entry }: { entry: VolunteerHoursEntryDTO }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("volunteer-hours")
  const { locale } = useLocale()
  const { day, month } = eventChip(entry.occurredAt, locale)

  const title =
    entry.source === "event"
      ? entry.eventTitle?.trim() || t("ledger.event_fallback")
      : entry.source === "report"
        ? t("ledger.report_row")
        : t("ledger.manual_row")

  const subParts = [
    entry.jurisdictionName?.trim() || null,
    entry.creditedBy ? t("ledger.credited_by", { name: entry.creditedBy.name }) : null,
  ].filter((part): part is string => !!part)

  const eventId = entry.eventId
  const reportId = entry.reportId
  const onPress = useCallback(() => {
    if (eventId) {
      useNavStore.getState().push({ kind: "cleanup", id: eventId, title })
      return
    }
    if (reportId) useNavStore.getState().push({ kind: "pin", id: reportId })
  }, [eventId, reportId, title])

  const pressable = !!eventId || !!reportId
  const hoursText = t("ledger.hours_unit", { hours: formatHoursDisplay(entry.hours, locale) })

  return (
    <Pressable
      onPress={pressable ? onPress : undefined}
      disabled={!pressable}
      accessibilityRole={pressable ? "button" : "text"}
      accessibilityLabel={t("ledger.row_a11y", {
        title,
        hours: formatHoursDisplay(entry.hours, locale),
      })}
      {...focusRingProps}
      style={({ pressed }) => [styles.row, pressed && pressable ? styles.pressedDim : null]}
    >
      <DateTile variant="ledger" day={day} month={month} />
      <View style={styles.rowMeta}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subParts.length > 0 ? (
          <View style={styles.rowSubRow}>
            {subParts.map((part, i) => (
              <React.Fragment key={part}>
                {i > 0 ? <MetaDot color={th.colors.textSubtle} style={styles.rowSubDot} /> : null}
                <Text
                  style={[styles.rowSub, i === subParts.length - 1 ? styles.rowSubLast : null]}
                  numberOfLines={1}
                >
                  {part}
                </Text>
              </React.Fragment>
            ))}
          </View>
        ) : null}
      </View>
      <Text style={styles.rowHours}>{hoursText}</Text>
    </Pressable>
  )
}

function LedgerRowSkeleton() {
  const styles = useStyles()
  return (
    <View style={styles.row}>
      <SkeletonBlock
        width={SKELETON_CHIP_SIZE}
        height={SKELETON_CHIP_SIZE}
        radius={SKELETON_CHIP_RADIUS}
        style={styles.skeletonChip}
      />
      <View style={styles.rowMeta}>
        <SkeletonBlock width="56%" height={11} radius={SKELETON_LINE_RADIUS} />
        <SkeletonBlock
          width="34%"
          height={9}
          radius={SKELETON_LINE_RADIUS}
          style={styles.skeletonLineSmall}
        />
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    padding: t.space["4"],
    ...t.shadows.s1,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bloom["50"],
  },
  totalCol: {
    flex: 1,
    minWidth: 0,
  },
  totalValue: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["30"],
    lineHeight: 34,
    letterSpacing: -0.6,
    color: t.colors.text,
  },
  totalLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.textMuted,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
    marginTop: t.space["3"],
  },
  chip: {
    paddingHorizontal: t.space["3"],
    paddingVertical: 6,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  chipText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textMuted,
  },
  orgChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    maxWidth: "100%",
  },
  orgChipText: {
    flexShrink: 1,
  },

  visibility: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingVertical: t.space["1"],
    marginTop: t.space["2"],
  },
  visibilityText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 12.5,
    color: t.colors.accentText,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["3"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  rowMeta: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  rowSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  rowSub: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  rowSubLast: {
    flexShrink: 1,
  },
  rowSubDot: {
    marginHorizontal: 5,
  },
  rowHours: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: t.fontSize["14"],
    color: t.colors.accentText,
  },

  skeletonChip: {
    flexShrink: 0,
  },
  skeletonLineSmall: {
    marginTop: 7,
  },

  pressedDim: {
    opacity: 0.85,
  },
}))
