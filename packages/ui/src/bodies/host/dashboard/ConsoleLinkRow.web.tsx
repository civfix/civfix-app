import React, { useCallback } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { focusRingProps, makeThemedStyles, useTheme } from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import { managePath, manageOrgPath, managePortfolioPath } from "../../../primitives/externalUrls"
import { openConsolePath } from "../../../primitives/consoleReach"
import { useOpenExternal } from "../../../capabilities"
import { useT } from "../../../i18n"
import type { ConsoleLinkRowProps, ConsoleLinkTarget } from "./ConsoleLinkRow.types"

function pathFor(target: ConsoleLinkTarget): string {
  switch (target.kind) {
    case "org":
      return manageOrgPath(target.orgId)
    case "event":
      return managePath(target.eventId)
    default:
      return managePortfolioPath()
  }
}

export function ConsoleLinkRow({ target }: ConsoleLinkRowProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const openExternal = useOpenExternal()

  const open = useCallback(() => {
    openConsolePath(pathFor(target), openExternal)
  }, [openExternal, target])

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={t("console.open")}
      {...focusRingProps}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      <View style={styles.icon}>
        <Icon icon={iconMap.Building2} size={16} color={th.colors.brand.sky} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.title}>{t("console.open")}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {t("console.sub")}
        </Text>
      </View>
      <Icon icon={iconMap.ChevronRight} size={18} color={th.colors.textSubtle} />
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"] + 2,
    borderRadius: t.radius.lg,
    paddingVertical: t.space["3"],
    paddingHorizontal: t.space["3"] + 1,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
  rowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: t.radius.md,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.sky["50"],
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  sub: {
    marginTop: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
}))
