import React from "react"
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import type { OrganizationRefDTO } from "@civfix/shared"
import { focusRingProps, makeThemedStyles, useTheme, webCursor, webHover, webTransition } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { Avatar } from "../primitives/Avatar"
import { useT } from "../i18n"
import { useNavStore } from "../nav/useNavStore"

export function AffiliationRow({
  organization,
  style,
}: {
  organization: OrganizationRefDTO
  style?: StyleProp<ViewStyle>
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("profile-view")
  const push = useNavStore((state) => state.push)
  return (
    <Pressable
      onPress={() => push({ kind: "org", slug: organization.slug })}
      accessibilityRole="button"
      accessibilityLabel={t("affiliation.open_a11y", { name: organization.name })}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        webTransition,
        webCursor(),
        webHover(state) ? styles.rowHovered : null,
        state.pressed ? styles.rowPressed : null,
        style,
      ]}
    >
      <Avatar
        name={organization.name}
        seed={organization.id}
        photoUrl={organization.logoUrl ?? null}
        size={28}
        style={styles.logo}
        decorative
      />
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{t("affiliation.label")}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {organization.name}
        </Text>
      </View>
      <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textSubtle} />
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  rowHovered: {
    borderColor: t.colors.borderStrong,
  },
  rowPressed: {
    opacity: 0.7,
  },
  logo: {
    borderRadius: t.radius.xs,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  name: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
    marginTop: 1,
  },
}))
