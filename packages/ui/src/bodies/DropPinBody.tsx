import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps, MIN_TOUCH_TARGET } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useReverseLabel, reverseLabelText } from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { useDraftReportStore } from "../report/draftStore"
import { useDroppedPin } from "../map/droppedPinStore"
import { armDropPinCleanup } from "../map/dropPinFlow"
import { planDropPinReportSeed } from "./cleanupDraftExit"
import { openReportFlow } from "./composerCreateFlow"

export interface DropPinBodyProps {
  lat: number | null
  lng: number | null
}

function ActionCard({
  icon,
  tone,
  title,
  sub,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>["icon"]
  tone: string
  title: string
  sub: string
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      {...focusRingProps}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={[styles.cardIcon, { backgroundColor: th.colors.neutral.card }]}>
        <Icon icon={icon} size={19} color={tone} />
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>
      <Icon icon={iconMap.ChevronRight} size={17} color={th.colors.textSubtle} />
    </Pressable>
  )
}

export function DropPinBody({ lat, lng }: DropPinBodyProps) {
  const { ScrollView } = useScrollHost()
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("map-ui")

  const point = useMemo(() => (lat != null && lng != null ? { lat, lng } : null), [lat, lng])
  const label = useReverseLabel(point)
  const display = point ? reverseLabelText(label.data, point) : ""

  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    if (lat != null && lng != null) useDroppedPin.getState().drop(lat, lng)
    armDropPinCleanup()
  }, [lat, lng])

  const seedReport = useCallback((p: { lat: number; lng: number }) => {
    useDraftReportStore.getState().setPrefilledLocation(p.lat, p.lng)
    openReportFlow()
  }, [])

  const onReport = useCallback(() => {
    if (!point) return
    const plan = planDropPinReportSeed(useDraftReportStore.getState().draft, point)
    if (plan === "confirm-reset") {
      setConfirmReset(true)
      return
    }
    seedReport(point)
  }, [point, seedReport])

  const onConfirmReset = useCallback(() => {
    if (!point) return
    setConfirmReset(false)
    useDraftReportStore.getState().reset()
    seedReport(point)
  }, [point, seedReport])

  const onCancel = useCallback(() => {
    const nav = useNavStore.getState()
    nav.back()
    if (nav.mode === "compact" && useNavStore.getState().stack.length === 0) nav.setSnap(0)
  }, [])

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.locationRow}>
        <Icon icon={iconMap.MapPin} size={16} color={th.colors.brand.bloom} />
        <Text style={styles.locationText} numberOfLines={2}>
          {display}
        </Text>
      </View>

      {confirmReset ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmTitle}>{t("dropPin.confirm.title")}</Text>
          <Text style={styles.confirmBody}>{t("dropPin.confirm.body")}</Text>
          <View style={styles.confirmActions}>
            <Pressable
              onPress={() => setConfirmReset(false)}
              accessibilityRole="button"
              accessibilityLabel={t("dropPin.confirm.keep")}
              {...focusRingProps}
              style={({ pressed }) => [styles.confirmKeep, pressed ? styles.pressed : null]}
            >
              <Text style={styles.confirmKeepText}>{t("dropPin.confirm.keep")}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirmReset}
              accessibilityRole="button"
              accessibilityLabel={t("dropPin.confirm.discard")}
              {...focusRingProps}
              style={({ pressed }) => [styles.confirmDiscard, pressed ? styles.pressed : null]}
            >
              <Text style={styles.confirmDiscardText}>{t("dropPin.confirm.discard")}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ActionCard
          icon={iconMap.Camera}
          tone={th.colors.brand.bloom}
          title={t("dropPin.report.title")}
          sub={t("dropPin.report.sub")}
          onPress={onReport}
        />
      )}

      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t("dropPin.cancelA11y")}
        {...focusRingProps}
        style={({ pressed }) => [styles.cancel, pressed ? styles.pressed : null]}
      >
        <Text style={styles.cancelText}>{t("dropPin.cancel")}</Text>
      </Pressable>
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
    gap: t.space["3"],
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    backgroundColor: t.colors.neutral.card,
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["3"],
  },
  locationText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    backgroundColor: t.colors.neutral.card,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"] + 2,
  },
  cardIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  cardMeta: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  cardSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  confirm: {
    gap: t.space["2"],
    backgroundColor: t.colors.neutral.card,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.borderStrong,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["4"],
  },
  confirmTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  confirmBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  confirmActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    marginTop: t.space["1"],
  },
  confirmKeep: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: MIN_TOUCH_TARGET,
    borderRadius: t.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  confirmKeepText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.textMuted,
  },
  confirmDiscard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: MIN_TOUCH_TARGET,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.brand.bloom,
  },
  confirmDiscardText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.onAccent,
  },
  cancel: {
    alignItems: "center",
    justifyContent: "center",
    height: MIN_TOUCH_TARGET,
  },
  cancelText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["15"],
    color: t.colors.textMuted,
  },
  pressed: {
    opacity: 0.9,
  },
}))
