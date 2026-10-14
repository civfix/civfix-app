import React from "react"
import type { EventTeamInviteIdentifierKind, OrgInviteIdentifierKind } from "@civfix/shared"
import { TextInput } from "../../primitives/TextInput"
import { makeThemedStyles, useTheme, webInputReset, inputFocusedStyle } from "../../theme"
import { Text } from "../../typography"
import { SegmentedControl, modalSheetInputStyle } from "../../primitives"
import { INVITE_IDENTIFIER_MAX } from "./hostTeamModel"
import { INPUT_MIN_HEIGHT } from "./hostLayout"

export type InviteIdentifierKind = EventTeamInviteIdentifierKind | OrgInviteIdentifierKind

const IDENTIFIER_KINDS: readonly InviteIdentifierKind[] = ["handle", "email"]

export interface InviteIdentifierLabels {
  kind: string
  byEmail: string
  byHandle: string
  email: string
  handle: string
}

export interface InviteIdentifierFieldsProps {
  labels: InviteIdentifierLabels
  identifierKind: InviteIdentifierKind
  identifier: string
  onPickKind: (kind: InviteIdentifierKind) => void
  onChangeIdentifier: (identifier: string) => void
  disabled: boolean
  focused: boolean
  onFocusChange: (focused: boolean) => void
}

export function InviteIdentifierFields({
  labels,
  identifierKind,
  identifier,
  onPickKind,
  onChangeIdentifier,
  disabled,
  focused,
  onFocusChange,
}: InviteIdentifierFieldsProps) {
  const styles = useStyles()
  const th = useTheme()
  const fieldLabel = identifierKind === "email" ? labels.email : labels.handle

  return (
    <>
      <Text variant="label">{labels.kind}</Text>
      <SegmentedControl
        label={labels.kind}
        options={IDENTIFIER_KINDS.map((kind) => ({
          key: kind,
          label: kind === "email" ? labels.byEmail : labels.byHandle,
        }))}
        selected={identifierKind}
        onSelect={(next) => onPickKind(next as InviteIdentifierKind)}
        disabled={disabled}
      />

      <Text variant="label">{fieldLabel}</Text>
      <TextInput
        value={identifier}
        onChangeText={(next) => onChangeIdentifier(next.slice(0, INVITE_IDENTIFIER_MAX))}
        editable={!disabled}
        maxLength={INVITE_IDENTIFIER_MAX}
        accessibilityLabel={fieldLabel}
        placeholderTextColor={th.colors.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={identifierKind === "email" ? "email-address" : "default"}
        textContentType={identifierKind === "email" ? "emailAddress" : "username"}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
        style={[webInputReset, styles.input, focused ? inputFocusedStyle(th) : null]}
      />
    </>
  )
}

const useStyles = makeThemedStyles((t) => ({
  input: {
    ...modalSheetInputStyle(t),
    minHeight: INPUT_MIN_HEIGHT,
  },
}))
