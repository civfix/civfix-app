import React from "react"
import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native"
import { useTheme, webInputReset } from "../theme"
import { iconMap } from "../typography"
import { useT } from "../i18n"
import { modalSheetInputFocusedStyle } from "../primitives/ModalCardSheet"
import { SignInPrompt } from "../primitives/StateView"
import { TextInput } from "../primitives/TextInput"

export interface ShareNoteInputProps {
  value: string
  onChangeText: (next: string) => void
  maxLength: number
  editable: boolean
  focused: boolean
  onFocusedChange: (focused: boolean) => void
  style: StyleProp<TextStyle>
}

export function ShareNoteInput({
  value,
  onChangeText,
  maxLength,
  editable,
  focused,
  onFocusedChange,
  style,
}: ShareNoteInputProps) {
  const th = useTheme()
  const { t } = useT("share-post")
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      maxLength={maxLength}
      placeholder={t("note.placeholder")}
      placeholderTextColor={th.colors.textSubtle}
      accessibilityLabel={t("note.a11y")}
      onFocus={() => onFocusedChange(true)}
      onBlur={() => onFocusedChange(false)}
      style={[webInputReset, style, focused ? modalSheetInputFocusedStyle(th) : null]}
    />
  )
}

export interface ShareSignedOutProps {
  onSignIn: () => void
  style: StyleProp<ViewStyle>
}

export function ShareSignedOut({ onSignIn, style }: ShareSignedOutProps) {
  const { t } = useT("share-post")
  return (
    <View style={style}>
      <SignInPrompt
        icon={iconMap.MessageCircle}
        title={t("signed_out.title")}
        body={t("signed_out.body")}
        variant="detail"
        onSignIn={onSignIn}
      />
    </View>
  )
}
