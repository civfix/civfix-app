import React from "react"
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import type { OrganizationRefDTO } from "@civfix/shared"
import { focusRingProps, makeThemedStyles, stopPress, webCursor } from "../theme"
import { Text } from "../typography"
import { useT } from "../i18n"
import { useNavStore } from "../nav/useNavStore"
import { Avatar } from "./Avatar"

export type OrgAffiliationBadgeSize = "sm" | "md"

export interface OrgAffiliationBadgeProps {
  organization: OrganizationRefDTO
  size?: OrgAffiliationBadgeSize
  showName?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

const LOGO_SIZE: Record<OrgAffiliationBadgeSize, number> = { sm: 16, md: 20 }

export function OrgAffiliationBadge({
  organization,
  size = "sm",
  showName = false,
  onPress,
  style,
}: OrgAffiliationBadgeProps) {
  const styles = useStyles()
  const { t } = useT("common")
  const push = useNavStore((state) => state.push)
  const logo = LOGO_SIZE[size]
  const label = t("org_affiliation", { name: organization.name })
  const open = React.useCallback(() => {
    if (onPress) {
      onPress()
      return
    }
    push({ kind: "org", slug: organization.slug })
  }, [onPress, push, organization.slug])
  return (
    <Pressable
      onPress={(event) => {
        stopPress(event)
        open()
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      {...focusRingProps}
      style={(state) => [
        styles.wrap,
        webCursor(false),
        state.pressed ? styles.pressed : null,
        style,
      ]}
    >
      <View style={[styles.logo, { width: logo, height: logo }]}>
        <Avatar
          name={organization.name}
          seed={organization.id}
          photoUrl={organization.logoUrl ?? null}
          size={logo}
          style={styles.logoShape}
          decorative
        />
      </View>
      {showName ? (
        <Text numberOfLines={1} style={styles.name}>
          {organization.name}
        </Text>
      ) : null}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
    minWidth: 0,
    borderRadius: t.radius.xs,
  },
  pressed: {
    opacity: 0.62,
  },
  logo: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoShape: {
    borderRadius: t.radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  name: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
}))
