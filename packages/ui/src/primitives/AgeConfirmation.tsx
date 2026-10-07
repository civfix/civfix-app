import React from "react"
import { View, Pressable } from "react-native"
import { makeThemedStyles, webCursor, webHover, focusRingProps, PRESSED_OPACITY } from "../theme"
import { Text } from "../typography"
import { useT } from "../i18n"
import { CheckboxBox } from "./CheckboxBox"

export interface AgeConfirmationProps {
  confirmed: boolean
  onConfirmedChange: (next: boolean) => void
}

export function AgeConfirmation({ confirmed, onConfirmedChange }: AgeConfirmationProps) {
  const styles = useStyles()
  const { t } = useT("onboarding-age")
  const affirmation = t("affirmation")
  const [under13, setUnder13] = React.useState(false)

  const toggle = React.useCallback(() => {
    if (!confirmed) setUnder13(false)
    onConfirmedChange(!confirmed)
  }, [confirmed, onConfirmedChange])

  const declareUnder13 = React.useCallback(() => {
    setUnder13(true)
    if (confirmed) onConfirmedChange(false)
  }, [confirmed, onConfirmedChange])

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        accessibilityLabel={affirmation}
        {...focusRingProps}
        style={(state) => [
          styles.row,
          webCursor(),
          webHover(state) ? styles.rowHovered : null,
          state.pressed ? styles.rowPressed : null,
        ]}
      >
        <CheckboxBox checked={confirmed} />
        <Text variant="body" style={styles.label}>
          {affirmation}
        </Text>
      </Pressable>

      {under13 ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text variant="caption" style={styles.noticeText} accessibilityRole="alert">
            {t("under13.message")}
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={declareUnder13}
          accessibilityRole="button"
          accessibilityLabel={t("under13.declare")}
          hitSlop={6}
          {...focusRingProps}
          style={({ pressed }) => [webCursor(), pressed ? styles.underPressed : null]}
        >
          <Text variant="caption" style={styles.under}>
            {t("under13.declare")}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    gap: t.space["2"],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
    minHeight: 52,
  },
  rowHovered: {
    borderColor: t.colors.borderStrong,
  },
  rowPressed: {
    opacity: 0.92,
  },
  label: {
    flex: 1,
  },
  under: {
    textAlign: "center",
    textDecorationLine: "underline",
  },
  underPressed: {
    opacity: PRESSED_OPACITY,
  },
  notice: {
    backgroundColor: t.colors.bgAlt,
    borderRadius: t.radius.sm,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
  },
  noticeText: {
    lineHeight: 18,
    color: t.colors.textMuted,
  },
}))
