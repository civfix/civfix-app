import React from "react"
import { View } from "react-native"
import { makeThemedStyles, useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { SkeletonBlock, SkeletonGroup, SkeletonText } from "../primitives"
import { useScrollHost } from "../shell/ScrollHost"

/** The host form's control height: its field rows and its footer buttons share one size. */
export const FORM_CONTROL_HEIGHT = 52

const SKELETON_FIELDS = [44, 88, 44, 44, 44] as const

export function EventFormSkeleton() {
  const { ScrollView } = useScrollHost()
  const styles = useStyles()
  const th = useTheme()
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {SKELETON_FIELDS.map((height, index) => (
        <SkeletonGroup key={index} style={styles.skeletonField}>
          <SkeletonText width="34%" height={11} />
          <SkeletonBlock width="100%" height={height} radius={th.radius.lg} />
        </SkeletonGroup>
      ))}
      <SkeletonBlock width="100%" height={44} radius={th.radius.pill} />
    </ScrollView>
  )
}

export function FormValidationRow({ error, hint }: { error: string | null; hint: string | null }) {
  const styles = useStyles()
  const th = useTheme()
  if (error) {
    return (
      <View style={styles.validationRow}>
        <Icon icon={iconMap.AlertCircle} size={15} color={th.colors.brand.bloom} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }
  if (!hint) return null
  return (
    <View style={styles.validationRow}>
      <Icon icon={iconMap.Info} size={15} color={th.colors.textSubtle} />
      <Text style={styles.hintText}>{hint}</Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
    gap: t.space["4"],
  },
  skeletonField: { gap: t.space["2"] },
  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  errorText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
  hintText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
}))
