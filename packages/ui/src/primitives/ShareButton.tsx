import React, { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, type StyleProp, type ViewStyle } from "react-native"
import {
  makeThemedStyles,
  useTheme,
  webCursor,
  webTransition,
  webHover,
  focusRingProps,
  webNoSelect,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { shareLink, absoluteUrl } from "./share"

export interface ShareButtonProps {
  title: string
  path: string
  message?: string
  label?: string
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

const COPIED_FEEDBACK_MS = 1600

export function ShareButton({
  title,
  path,
  message,
  label,
  accessibilityLabel,
  style,
}: ShareButtonProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("common-share")
  const resolvedLabel = label ?? t("button.label")
  const resolvedAccessibilityLabel = accessibilityLabel ?? t("button.accessibilityLabel")
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const onPress = useCallback(() => {
    const sheetMessage =
      message ?? t("sheet.message", { title, url: absoluteUrl(path) })
    void shareLink({ title, path, message: sheetMessage }).then((result) => {
      if (result !== "copied") return
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    })
  }, [title, path, message, t])

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={resolvedAccessibilityLabel}
      hitSlop={6}
      {...focusRingProps}
      style={(state) => [
        styles.btn,
        webTransition,
        webCursor(false),
        webHover(state) ? styles.hovered : null,
        state.pressed ? styles.pressed : null,
        style,
      ]}
    >
      <Icon
        icon={copied ? iconMap.Check : iconMap.Share}
        size={16}
        color={copied ? th.colors.moss["700"] : th.colors.text}
      />
      <Text
        variant="body"
        numberOfLines={1}
        color={copied ? th.colors.moss["700"] : th.colors.text}
        style={[styles.label, webNoSelect]}
      >
        {copied ? t("button.copied") : resolvedLabel}
      </Text>
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 34,
    flexShrink: 0,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  hovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13,
  },
}))
