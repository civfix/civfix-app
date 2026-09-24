import React from "react"
import { View } from "react-native"
import type { GetEventAnalyticsResponse } from "@civfix/shared"
import { Text } from "../../../typography"
import { EMPTY_VALUE, useT } from "../../../i18n"
import { funnelBars } from "../analyticsModel"
import { useAnalyticsStyles } from "./analyticsStyles"
import { FractionBar } from "./FractionBar"

export function FunnelSection({ data }: { data: GetEventAnalyticsResponse }) {
  const styles = useAnalyticsStyles()
  const { t } = useT("host-analytics")
  const bars = funnelBars(data.reach.funnel)

  if (bars.length === 0) return <Text variant="caption">{t("page.funnel_empty")}</Text>

  return (
    <View style={styles.block} role="group" accessibilityLabel={t("funnel.a11y")}>
      {bars.map((bar) => (
        <View key={bar.step} style={styles.funnelRow}>
          <View style={styles.funnelHead}>
            <Text variant="caption" numberOfLines={1} style={styles.funnelLabel}>
              {t(`funnel.${bar.step}`)}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {bar.value === null
                ? EMPTY_VALUE
                : bar.ofPrevious === null
                  ? String(bar.value)
                  : t("funnel.of_previous", { value: bar.value, rate: bar.ofPrevious })}
            </Text>
          </View>
          <FractionBar fraction={bar.fraction} ghost={bar.ghost} />
        </View>
      ))}
    </View>
  )
}
