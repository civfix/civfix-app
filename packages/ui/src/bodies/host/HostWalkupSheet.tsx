import React, { useCallback, useState } from "react"
import { View } from "react-native"
import { TextInput } from "../../primitives/TextInput"
import type { TicketTypeDTO } from "@civfix/shared"
import { MAX_ATTENDEE_NAME } from "@civfix/shared"
import { clampPartySize, registerOutcomeKey, sortedTicketTypes } from "@civfix/shared/host"
import { makeThemedStyles, useTheme, webInputReset } from "../../theme"
import { Text } from "../../typography"
import {
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  modalSheetInputFocusedStyle,
  modalSheetInputStyle,
  useToast,
} from "../../primitives"
import { useT } from "../../i18n"
import { useWalkupRegistration } from "../../data/hooks/host"
import { appErrorCode } from "../../data/errorCode"
import { TicketTypePicker } from "./registration/TicketTypePicker"
import { PartySizeStepper } from "./registration/PartySizeStepper"
import { INPUT_MIN_HEIGHT } from "./hostLayout"
import { resolveTicketTypeId } from "./registration/registrationModel"

export interface HostWalkupSheetProps {
  visible: boolean
  cleanupId: string
  ticketTypes: readonly TicketTypeDTO[]
  onClose: () => void
}

export function HostWalkupSheet({ visible, cleanupId, ticketTypes, onClose }: HostWalkupSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-mode")
  const toast = useToast()
  const walkup = useWalkupRegistration(cleanupId)

  const types = sortedTicketTypes(ticketTypes)
  const [name, setName] = useState("")
  const [pickedTypeId, setPickedTypeId] = useState<string | null>(null)
  const [partySize, setPartySize] = useState(1)
  const [focused, setFocused] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  const ticketTypeId = resolveTicketTypeId(types, pickedTypeId)

  const onClosed = useCallback(() => {
    setName("")
    setPartySize(1)
    setErrorText(null)
    setPickedTypeId(null)
    setFocused(false)
    if (!walkup.isPending) walkup.reset()
  }, [walkup])

  const selected = types.find((type) => type.id === ticketTypeId) ?? null
  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0 && !walkup.isPending

  const submit = useCallback(() => {
    if (!canSubmit) return
    setErrorText(null)
    walkup.mutate(
      {
        name: trimmed,
        partySize: selected ? clampPartySize(partySize, selected.maxPartySize) : 1,
        checkInNow: true,
        ...(selected ? { ticketTypeId: selected.id } : {}),
      },
      {
        onSuccess: (res) => {
          const key = registerOutcomeKey(res.outcome)
          if (key) {
            setErrorText(t(`host-ticket:${key}`))
            return
          }
          toast.show(t("walkup.success", { name: trimmed }), { variant: "success" })
          onClose()
        },
        onError: (err) =>
          setErrorText(appErrorCode(err) === "FORBIDDEN" ? t("walkup.error_forbidden") : t("walkup.error")),
      },
    )
  }, [canSubmit, onClose, partySize, selected, t, toast, trimmed, walkup])

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      onCommit={submit}
      headerIcon="UserPlus"
      headerIconColor={th.colors.moss["700"]}
      title={t("walkup.title")}
      dismissLabel={t("walkup.dismiss_a11y")}
      backdropDismissDisabled={walkup.isPending}
      error={errorText}
      actions={
        <>
          <SecondaryButton label={t("walkup.cancel")} onPress={onClose} size="sm" disabled={walkup.isPending} />
          <PrimaryButton
            label={t("walkup.submit")}
            onPress={submit}
            loading={walkup.isPending}
            disabled={!canSubmit}
          />
        </>
      }
    >
      <Text variant="caption" color={th.colors.textSubtle}>
        {t("walkup.caption")}
      </Text>

      <Text variant="label">{t("walkup.name_label")}</Text>
      <TextInput
        value={name}
        onChangeText={(next) => setName(next.slice(0, MAX_ATTENDEE_NAME))}
        editable={!walkup.isPending}
        maxLength={MAX_ATTENDEE_NAME}
        placeholder={t("walkup.name_placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        accessibilityLabel={t("walkup.name_label")}
        autoCapitalize="words"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[webInputReset, styles.input, focused ? modalSheetInputFocusedStyle(th) : null]}
      />

      {types.length > 1 ? (
        <View style={styles.section}>
          <Text variant="label">{t("walkup.type_label")}</Text>
          <TicketTypePicker
            ticketTypes={types}
            selectedId={ticketTypeId}
            onSelect={setPickedTypeId}
            disabled={walkup.isPending}
          />
        </View>
      ) : null}

      {selected ? (
        <PartySizeStepper
          value={partySize}
          max={selected.maxPartySize}
          onChange={setPartySize}
          disabled={walkup.isPending}
        />
      ) : null}
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  input: {
    ...modalSheetInputStyle(t),
    minHeight: INPUT_MIN_HEIGHT,
  },
  section: {
    gap: t.space["2"],
  },
}))
