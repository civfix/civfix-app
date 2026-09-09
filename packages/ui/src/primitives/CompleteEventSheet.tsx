import React, { useCallback } from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { ModalCardSheet } from "./ModalCardSheet"
import { useT } from "../i18n"

const POINTS = [
  "complete_sheet.point_visible",
  "complete_sheet.point_hours",
  "complete_sheet.point_final",
] as const

export interface CompleteEventSheetProps {
  visible: boolean
  pending?: boolean
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}

export function CompleteEventSheet({
  visible,
  pending = false,
  error,
  onConfirm,
  onClose,
}: CompleteEventSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-detail")

  const commit = useCallback(() => {
    if (pending) return
    onConfirm()
  }, [pending, onConfirm])

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onCommit={commit}
      headerIcon="CheckCheck"
      headerIconColor={th.colors.moss["700"]}
      title={t("complete_sheet.title")}
      dismissLabel={t("complete_sheet.dismiss_a11y")}
      error={error}
      actions={
        <>
          <Pressable
            onPress={onClose}
            disabled={pending}
            accessibilityRole="button"
            accessibilityLabel={t("complete_sheet.cancel")}
            {...focusRingProps}
            style={({ pressed }) => [styles.btn, pressed ? styles.pressed : null]}
          >
            <Text style={styles.cancelText}>{t("complete_sheet.cancel")}</Text>
          </Pressable>
          <Pressable
            onPress={commit}
            disabled={pending}
            accessibilityRole="button"
            accessibilityLabel={t("complete_sheet.confirm")}
            accessibilityState={{ disabled: pending, busy: pending }}
            {...focusRingProps}
            style={({ pressed }) => [
              styles.btn,
              styles.confirm,
              pending ? styles.confirmDisabled : null,
              pressed && !pending ? styles.pressed : null,
            ]}
          >
            {pending ? (
              <ActivityIndicator size="small" color={th.colors.onAccent} />
            ) : (
              <Text style={styles.confirmText}>{t("complete_sheet.confirm")}</Text>
            )}
          </Pressable>
        </>
      }
    >
      <Text style={styles.body}>{t("complete_sheet.body")}</Text>

      <View style={styles.points}>
        {POINTS.map((point) => (
          <View key={point} style={styles.pointRow}>
            <View style={styles.pointCheck}>
              <Icon icon={iconMap.Check} size={13} color={th.colors.moss["700"]} />
            </View>
            <Text style={styles.pointText}>{t(point)}</Text>
          </View>
        ))}
      </View>
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  body: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: t.colors.textMuted,
  },
  points: {
    gap: t.space["2"],
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  pointCheck: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.moss["50"],
  },
  pointText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13.5,
    color: t.colors.text,
  },
  btn: {
    height: 38,
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.textMuted,
  },
  confirm: {
    minWidth: 120,
    backgroundColor: t.colors.brand.moss,
  },
  confirmDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.onAccent,
  },
  pressed: {
    opacity: 0.85,
  },
}))
