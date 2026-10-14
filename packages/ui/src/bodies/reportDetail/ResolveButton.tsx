import React, { useCallback } from "react"
import { Pressable, ActivityIndicator } from "react-native"
import type { ReportDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { useResolveReport } from "../../data"
import { useT } from "../../i18n"
import { useReportDetailSharedStyles } from "./sharedStyles"

export function ResolveButton({ report }: { report: ReportDTO }) {
  const styles = useStyles()
  const shared = useReportDetailSharedStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const resolve = useResolveReport(report.id)
  const isResolved = report.status === "resolved"
  const onPress = useCallback(() => {
    resolve.mutate(!isResolved)
  }, [resolve, isResolved])

  return (
    <Pressable
      onPress={onPress}
      disabled={resolve.isPending}
      accessibilityRole="button"
      accessibilityState={{ busy: resolve.isPending }}
      accessibilityLabel={isResolved ? t("actions.reopen_a11y") : t("actions.mark_resolved_a11y")}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.resolveBtn,
        isResolved ? styles.resolveBtnReopen : styles.resolveBtnResolve,
        pressed || resolve.isPending ? shared.pressed : null,
      ]}
    >
      {resolve.isPending ? (
        <ActivityIndicator
          size="small"
          color={isResolved ? th.colors.text : th.colors.moss["700"]}
        />
      ) : (
        <Icon
          icon={isResolved ? iconMap.RefreshCw : iconMap.CheckCircle2}
          size={17}
          color={isResolved ? th.colors.text : th.colors.moss["700"]}
        />
      )}
      <Text
        style={[styles.resolveText, isResolved ? styles.resolveTextReopen : styles.resolveTextResolve]}
        numberOfLines={1}
      >
        {isResolved ? t("actions.reopen") : t("actions.mark_resolved")}
      </Text>
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  resolveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 46,
    marginTop: t.space["4"],
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
  },
  resolveBtnResolve: {
    backgroundColor: t.colors.moss["50"],
    borderColor: t.colors.brand.moss,
  },
  resolveBtnReopen: {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.borderStrong,
  },
  resolveText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
  },
  resolveTextResolve: {
    color: t.colors.moss["700"],
  },
  resolveTextReopen: {
    color: t.colors.text,
  },
}))
