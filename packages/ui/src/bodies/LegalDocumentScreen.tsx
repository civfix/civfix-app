import React, { useContext } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import type { LegalDocumentType } from "@civfix/contract"
import { MIN_TOUCH_TARGET, focusRingProps, makeThemedStyles, useTheme } from "../theme"
import { Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { LegalDocumentBody } from "./LegalDocumentBody"

const BACK_ICON_SIZE = 21
const BACK_HIT_SLOP = 6

export interface LegalDocumentScreenProps {
  type: LegalDocumentType
  onBack: () => void
}

/** The phone app's full-screen reader for one legal document, opened from any legal link in the app. */
export function LegalDocumentScreen({ type, onBack }: LegalDocumentScreenProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("legal")
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 }

  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          hitSlop={BACK_HIT_SLOP}
          {...focusRingProps}
          style={styles.back}
        >
          <Icon icon={iconMap.ArrowLeft} size={BACK_ICON_SIZE} color={th.colors.text} />
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + th.space["8"] }]}
      >
        <LegalDocumentBody type={type} />
      </ScrollView>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  page: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  header: {
    minHeight: MIN_TOUCH_TARGET + t.space["2"],
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: t.space["4"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  back: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -t.space["3"],
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: t.space["5"],
    paddingHorizontal: t.space["5"],
  },
}))
