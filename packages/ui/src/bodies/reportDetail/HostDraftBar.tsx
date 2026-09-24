import React from "react"
import { View, Pressable } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { useNavStore } from "../../nav"
import { useT } from "../../i18n"
import { useCleanupDraft } from "../cleanupDraftStore"
import { useReportDetailSharedStyles } from "./sharedStyles"

export function HostDraftBar({ reportId }: { reportId: string }) {
  const styles = useStyles()
  const shared = useReportDetailSharedStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const hostDraftActive = useCleanupDraft((s) => s.active)
  const linkedCount = useCleanupDraft((s) => s.value?.linkedReportIds.length ?? 0)
  const isLinked = useCleanupDraft((s) => s.value?.linkedReportIds.includes(reportId) ?? false)

  if (!hostDraftActive) return null
  return (
    <View style={styles.hostDraftBar}>
      <Pressable
        onPress={() => {
          const nav = useNavStore.getState()
          if (!nav.unwindTo({ kind: "create-cleanup" })) nav.push({ kind: "create-cleanup" })
        }}
        accessibilityRole="button"
        accessibilityLabel={t("hostDraft.back", { count: linkedCount })}
        {...focusRingProps}
        style={({ pressed }) => [styles.hostDraftBack, pressed ? shared.pressed : null]}
      >
        <Icon icon={iconMap.ArrowLeft} size={16} color={th.colors.text} />
        <Text style={styles.hostDraftBackText} numberOfLines={1}>
          {t("hostDraft.back", { count: linkedCount })}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => useCleanupDraft.getState().toggleLinkedReport(reportId)}
        accessibilityRole="button"
        accessibilityState={{ selected: isLinked }}
        accessibilityLabel={isLinked ? t("hostDraft.remove") : t("hostDraft.add")}
        {...focusRingProps}
        style={({ pressed }) => [
          styles.hostDraftToggle,
          isLinked ? styles.hostDraftToggleOn : styles.hostDraftToggleOff,
          pressed ? shared.pressed : null,
        ]}
      >
        <Icon
          icon={isLinked ? iconMap.Check : iconMap.Plus}
          size={15}
          color={isLinked ? th.colors.text : th.colors.onAccent}
        />
        <Text
          style={[
            styles.hostDraftToggleText,
            { color: isLinked ? th.colors.text : th.colors.onAccent },
          ]}
        >
          {isLinked ? t("hostDraft.remove") : t("hostDraft.add")}
        </Text>
      </Pressable>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  hostDraftBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["2"],
    backgroundColor: t.colors.moss["50"],
    borderRadius: t.radius.md,
    marginBottom: t.space["2"],
  },
  hostDraftBack: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
  hostDraftBackText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  hostDraftToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
  },
  hostDraftToggleOn: {
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  hostDraftToggleOff: { backgroundColor: t.colors.brand.bloom },
  hostDraftToggleText: { fontFamily: t.fontFamily.bodyBold, fontSize: t.fontSize["13"] },
}))
