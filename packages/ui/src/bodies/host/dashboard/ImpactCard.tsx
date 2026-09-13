import React from "react"
import { View } from "react-native"
import type { HostedEventsAnalyticsResponse } from "@civfix/shared"
import { makeThemedStyles } from "../../../theme"
import { Text } from "../../../typography"
import { formatRate, formatStatValue, HeroFigure, SectionCard } from "../../../primitives"
import { useLocale, useT } from "../../../i18n"
import { FeedNotice } from "../../FeedNotice"
import { formatHoursDisplay } from "../../formatHours"
import { ImpactSkeleton } from "../HostSkeletons"
import { impactModel } from "./dashboardModel"

const META_SEPARATOR = " · "

export interface ImpactCardProps {
  analytics: HostedEventsAnalyticsResponse | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}

export function ImpactCard({ analytics, isPending, isError, onRetry }: ImpactCardProps) {
  const styles = useStyles()
  const { t } = useT("event-dashboard")
  const { locale } = useLocale()

  const allTime = <Text variant="caption">{t("impact.all_time")}</Text>

  if (isError) {
    return (
      <SectionCard label={t("impact.section")} trailing={allTime}>
        <FeedNotice
          icon="CloudOff"
          title={t("impact.error_title")}
          body={t("impact.error_body")}
          actionLabel={t("impact.retry")}
          onAction={onRetry}
        />
      </SectionCard>
    )
  }

  if (isPending) return <ImpactSkeleton />

  const model = impactModel(analytics)
  if (!model) return null

  const hours = model.hero.unit === "hours"
  const value = hours
    ? formatHoursDisplay(model.hero.value, locale)
    : (formatStatValue(model.hero.value, locale) ?? String(model.hero.value))
  const showedUp = model.showedUp === null ? null : formatRate(model.showedUp, locale)
  const cameBack = model.cameBack === null ? null : formatRate(model.cameBack, locale)

  const meta = [
    hours && model.volunteersCredited !== null && model.volunteersCredited > 0
      ? t("impact.credited", { count: model.volunteersCredited })
      : null,
    hours ? t("impact.volunteers", { count: model.uniqueAttendees }) : null,
    t("impact.events", { count: model.events }),
    showedUp === null ? null : t("impact.showed_up", { rate: showedUp }),
  ].filter((part): part is string => part !== null)

  return (
    <SectionCard label={t("impact.section")} trailing={allTime}>
      <View style={styles.root}>
        <HeroFigure
          compact
          value={value}
          unit={t(hours ? "impact.unit_hours" : "impact.unit_volunteers")}
        />
        <Text variant="label" numberOfLines={1}>
          {meta.join(META_SEPARATOR)}
        </Text>
        {cameBack === null ? null : (
          <Text variant="caption" numberOfLines={1}>
            {t("impact.came_back", { rate: cameBack })}
          </Text>
        )}
      </View>
    </SectionCard>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["1"],
  },
}))
