import React from "react"
import { View, StyleSheet } from "react-native"
import type { UseQueryResult } from "@tanstack/react-query"
import type { EventCheckinCountersDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text } from "../../typography"
import { SkeletonText } from "../../primitives"
import { useT } from "../../i18n"

export interface HostCounterStripProps {
  query: UseQueryResult<EventCheckinCountersDTO>
}

function Cell({ label, value }: { label: string; value: string }) {
  const styles = useStyles()
  return (
    <View style={styles.cell}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

export function HostCounterStrip({ query }: HostCounterStripProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-common")

  if (query.isLoading) {
    return (
      <View style={styles.strip}>
        <SkeletonText width="22%" height={28} />
        <SkeletonText width="22%" height={28} />
        <SkeletonText width="22%" height={28} />
        <SkeletonText width="22%" height={28} />
      </View>
    )
  }

  if (query.isError || !query.data) {
    return (
      <View style={styles.strip}>
        <Text style={[styles.label, { color: th.colors.textSubtle }]}>{t("counters.error")}</Text>
      </View>
    )
  }

  const data = query.data
  const capacity = data.capacity
  return (
    <View style={styles.strip} accessibilityLabel={t("counters.a11y")}>
      <Cell label={t("counters.checked_in")} value={String(data.checkedIn)} />
      <Cell
        label={t("counters.registered")}
        value={capacity != null ? `${data.registered}/${capacity}` : String(data.registered)}
      />
      <Cell label={t("counters.waitlist")} value={String(data.waitlisted)} />
      <Cell label={t("counters.no_show")} value={String(data.noShow)} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  value: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["20"],
    color: t.colors.text,
  },
  label: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: t.colors.textSubtle,
    textAlign: "center",
  },
}))
