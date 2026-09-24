import React from "react"
import { Pressable, View } from "react-native"
import type { TFunction } from "i18next"
import { focusRingProps, useTheme } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import type { PostComposerModel } from "../postComposerModel"
import { usePostComposerStyles } from "./postComposerStyles"

export function ComposerHeader({
  presentation,
  t,
  onClose,
  onSubmit,
  submitDisabled,
  posting,
}: {
  presentation: PostComposerModel
  t: TFunction
  onClose: () => void
  onSubmit: () => void
  submitDisabled: boolean
  posting: boolean
}) {
  const styles = usePostComposerStyles()
  const th = useTheme()
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("close_a11y")}
        onPress={onClose}
        {...focusRingProps}
        style={({ pressed }) => [styles.closeButton, pressed ? styles.buttonPressed : null]}
      >
        <Icon icon={iconMap.Close} size={17} color={th.colors.text} strokeWidth={2} />
      </Pressable>
      <View pointerEvents="none" style={styles.headerTitleWrap}>
        <Text accessibilityRole="header" style={styles.headerTitle}>{presentation.title}</Text>
      </View>
      <View style={styles.headerSpacer} />
      <Pressable
        accessibilityRole="button"
        onPress={onSubmit}
        disabled={submitDisabled}
        {...focusRingProps}
        style={({ pressed }) => [styles.postButton, submitDisabled ? styles.postButtonDisabled : null, pressed ? styles.buttonPressed : null]}
      >
        <Text style={[styles.postButtonText, submitDisabled ? styles.postButtonTextDisabled : null]}>{posting ? t("action.posting") : presentation.submitLabel}</Text>
      </Pressable>
    </View>
  )
}
