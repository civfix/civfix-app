import React, { useCallback, useMemo, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { PRESSED_OPACITY, makeThemedStyles, useTheme } from "@/theme"
import { Text, PopoverMenu, usePopoverAnchor, type AnchorRect, type PopoverMenuItem } from "@civfix/ui"
import { useLocale, useT, supportedLocales } from "@civfix/ui/i18n"
import { Wordmark } from "@/components/Wordmark"

const WORDMARK_SIZE = 28

function LanguagePill() {
  const { t } = useT("mobile-onboarding")
  const th = useTheme()
  const styles = useStyles()
  const { locale, setLocale } = useLocale()
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<AnchorRect | null>(null)
  const { ref, measure } = usePopoverAnchor(setRect)

  const items = useMemo<PopoverMenuItem[]>(
    () =>
      supportedLocales.map((entry) => ({
        key: entry.code,
        label: entry.nativeName,
        onPress: () => setLocale(entry.code),
      })),
    [setLocale],
  )

  const onPress = useCallback(() => {
    measure()
    setOpen(true)
  }, [measure])

  const current = supportedLocales.find((entry) => entry.code === locale)

  return (
    <>
      <Pressable
        ref={ref}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.language")}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.pill, pressed ? styles.pressed : null]}
      >
        <Text variant="label" color={th.colors.textMuted}>
          {current?.nativeName ?? locale}
        </Text>
      </Pressable>
      <PopoverMenu
        visible={open}
        anchorRect={rect}
        onClose={() => setOpen(false)}
        items={items}
        align="left"
      />
    </>
  )
}

export function OnboardingHeader({
  page,
  showSkip,
  onSkip,
}: {
  page: number
  showSkip: boolean
  onSkip: () => void
}) {
  const { t } = useT("mobile-onboarding")
  const th = useTheme()
  const styles = useStyles()
  return (
    <View style={styles.row}>
      <Wordmark size={WORDMARK_SIZE} />
      <View style={styles.trailing}>
        {page === 0 ? <LanguagePill /> : null}
        {showSkip ? (
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.skip")}
            style={({ pressed }) => [styles.skip, pressed ? styles.pressed : null]}
          >
            <Text variant="bodyStrong" color={th.colors.accentText}>
              {t("nav.skip")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: t.space["5"],
    minHeight: 44,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  pill: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surface,
  },
  skip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: t.space["2"],
  },
  pressed: {
    opacity: PRESSED_OPACITY,
  },
}))
