import React from "react"
import type { StyleProp, TextStyle } from "react-native"
import { webNoSelect } from "../theme"
import { Text, Icon, type LucideIcon } from "../typography"

export function MenuItemContent({
  icon,
  iconSize,
  color,
  label,
  labelStyle,
}: {
  icon: LucideIcon | null
  iconSize: number
  color: string
  label: string
  labelStyle: StyleProp<TextStyle>
}) {
  return (
    <>
      {icon ? <Icon icon={icon} size={iconSize} color={color} /> : null}
      <Text variant="body" color={color} numberOfLines={1} style={[labelStyle, webNoSelect]}>
        {label}
      </Text>
    </>
  )
}
