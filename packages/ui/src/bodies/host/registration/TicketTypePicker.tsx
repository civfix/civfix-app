import React from "react"
import { View, Pressable } from "react-native"
import type { TicketTypeDTO } from "@civfix/shared"
import { focusRingProps, makeThemedStyles, useTheme, webCursor, webHover, webTransition } from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import { useT } from "../../../i18n"
import { ticketTypeSelectable } from "./registrationModel"

export interface TicketTypePickerProps {
  ticketTypes: readonly TicketTypeDTO[]
  selectedId: string | null
  onSelect: (ticketTypeId: string) => void
  disabled?: boolean
}

export function TicketTypePicker({
  ticketTypes,
  selectedId,
  onSelect,
  disabled = false,
}: TicketTypePickerProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-ticket")

  if (ticketTypes.length === 0) return null

  return (
    <View
      style={styles.list}
      accessibilityRole="radiogroup"
      accessibilityLabel={t("picker.heading")}
    >
      {ticketTypes.map((type) => {
        const selected = type.id === selectedId
        const selectable = ticketTypeSelectable(type)
        const inert = disabled || !selectable
        const status = type.soldOut
          ? t("picker.sold_out")
          : !type.salesOpen
            ? t("picker.closed")
            : type.remaining != null
              ? t("picker.remaining", { count: type.remaining })
              : null
        return (
          <Pressable
            key={type.id}
            onPress={inert ? undefined : () => onSelect(type.id)}
            disabled={inert}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: inert }}
            accessibilityLabel={type.name}
            {...focusRingProps}
            style={(state) => [
              styles.row,
              webTransition,
              webCursor(inert),
              selected ? styles.rowSelected : null,
              inert ? styles.rowInert : null,
              !inert && webHover(state) ? styles.rowHovered : null,
              state.pressed && !inert ? styles.rowPressed : null,
            ]}
          >
            <Icon
              icon={selected ? iconMap.CircleDot : iconMap.Circle}
              size={18}
              color={selected ? th.colors.brand.bloom : th.colors.textSubtle}
            />
            <View style={styles.meta}>
              <Text style={styles.name} numberOfLines={1}>
                {type.name}
              </Text>
              {type.description ? (
                <Text style={styles.description} numberOfLines={2}>
                  {type.description}
                </Text>
              ) : null}
              {status ? <Text style={styles.status}>{status}</Text> : null}
            </View>
            {type.visibility === "access_code" ? (
              <Icon icon={iconMap.Lock} size={14} color={th.colors.textSubtle} />
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  list: {
    gap: t.space["2"],
  },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
    borderRadius: t.radius.lg,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  rowSelected: {
    borderColor: t.colors.brand.bloom,
  },
  rowHovered: {
    borderColor: t.colors.borderStrong,
  },
  rowPressed: {
    opacity: 0.9,
  },
  rowInert: {
    opacity: 0.55,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  description: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
    marginTop: 1,
  },
  status: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    marginTop: 2,
  },
}))
