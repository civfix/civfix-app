import { Pressable, StyleSheet, View } from "react-native"
import { focusRingProps, headingLevel, makeThemedStyles, useLayoutMode, useTheme, webCursor, webHover } from "../theme"
import { Icon, iconMap, Text } from "../typography"
import { PrimaryButton } from "../primitives/PrimaryButton"
import { useT } from "../i18n"
import { useTabBarStore } from "../shell/tabBarStore"

const CARD_MAX_WIDTH = 360

export interface PushPromptCardProps {
  onTurnOn: () => void
  onNotNow: () => void
  onClose: () => void
}

/**
 * The one-time ask for browser notifications. A floating card that leaves the page usable: under the
 * map's top-right controls (the avatar it relates to) when expanded, above the tab bar when compact.
 */
export function PushPromptCard({ onTurnOn, onNotNow, onClose }: PushPromptCardProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("push-prompt")
  const expanded = useLayoutMode() === "expanded"
  const tabBarHeight = useTabBarStore((s) => s.tabBarHeight)
  return (
    <View
      pointerEvents="box-none"
      style={expanded ? styles.anchorExpanded : [styles.anchorCompact, { bottom: tabBarHeight + th.space["3"] }]}
    >
      <View
        accessibilityRole="none"
        {...({ role: "dialog", "aria-modal": false, "aria-labelledby": "civfix-push-prompt-title" } as object)}
        style={[styles.card, th.shadows.s3, expanded ? styles.cardExpanded : null]}
      >
        <View style={styles.head}>
          <View style={styles.iconTile}>
            <Icon icon={iconMap.Bell} size={20} color={th.colors.accentText} />
          </View>
          <Text
            variant="bodyStrong"
            style={styles.title}
            {...headingLevel(2)}
            nativeID="civfix-push-prompt-title"
          >
            {t("title")}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
            hitSlop={6}
            {...focusRingProps}
            style={(state) => [styles.close, webCursor(), webHover(state) ? styles.closeHovered : null]}
          >
            <Icon icon={iconMap.Close} size={16} color={th.colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.actions}>
          <View style={styles.action}>
            <PrimaryButton variant="ghost" label={t("not_now")} onPress={onNotNow} />
          </View>
          <View style={styles.action}>
            <PrimaryButton label={t("turn_on")} onPress={onTurnOn} />
          </View>
        </View>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  anchorCompact: {
    position: "absolute",
    left: t.space["3"],
    right: t.space["3"],
    alignItems: "center",
  },
  anchorExpanded: {
    position: "absolute",
    top: t.space["16"] + t.space["3"],
    right: t.space["3"],
  },
  card: {
    width: "100%",
    maxWidth: CARD_MAX_WIDTH,
    padding: t.space["4"],
    gap: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  cardExpanded: { width: CARD_MAX_WIDTH },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  iconTile: {
    width: t.space["10"],
    height: t.space["10"],
    borderRadius: t.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bloom["50"],
  },
  title: { flex: 1 },
  close: {
    width: t.space["8"],
    height: t.space["8"],
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  closeHovered: { backgroundColor: t.colors.bgAlt },
  actions: {
    flexDirection: "row",
    gap: t.space["2"],
  },
  action: { flex: 1 },
}))
