import React, { useCallback } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps, webSelectableText } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useToast } from "../primitives"
import { useClipboard, useOpenExternal } from "../capabilities"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"

const SCHEDULE_CALL_URL = "https://cal.com/romanaytur/meet-with-roman"

const EXAMPLE_KEYS = ["volunteer", "nonprofit", "leader"] as const

export function GetVerifiedBody() {
  const { ScrollView } = useScrollHost()
  const styles = useStyles()
  const th = useTheme()
  const openExternal = useOpenExternal()
  const clipboard = useClipboard()
  const toast = useToast()
  const { t } = useT("profile-verify")

  const onScheduleCall = useCallback(() => {
    if (!openExternal) return
    openExternal
      .open(SCHEDULE_CALL_URL)
      .catch(() => toast.show(t("schedule.open_error"), { variant: "error" }))
  }, [openExternal, toast, t])

  const onCopyLink = useCallback(() => {
    if (!clipboard) return
    void clipboard
      .setString(SCHEDULE_CALL_URL)
      .then(() => toast.show(t("schedule.copied"), { variant: "success" }))
      .catch(() => {})
  }, [clipboard, toast, t])

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.explainer}>
        <View style={styles.explainerIcon}>
          <Icon icon={iconMap.CheckCircle2} size={20} color={th.colors.brand.sky} />
        </View>
        <Text style={styles.explainerText}>{t("explainer")}</Text>
      </View>

      <Text style={styles.sectionLabel}>{t("section.label")}</Text>
      <Text style={styles.criteria}>{t("criteria")}</Text>

      <View style={styles.examples}>
        <Text style={styles.examplesHint}>{t("examples.hint")}</Text>
        {EXAMPLE_KEYS.map((key) => (
          <View key={key} style={styles.exampleRow}>
            <View style={styles.exampleCheck}>
              <Icon icon={iconMap.Check} size={13} color={th.colors.moss["700"]} />
            </View>
            <Text style={styles.exampleText}>{t(`examples.items.${key}`)}</Text>
          </View>
        ))}
      </View>

      {openExternal ? (
        <>
          <Pressable
            onPress={onScheduleCall}
            accessibilityRole="button"
            accessibilityLabel={t("schedule.a11yLabel")}
            {...focusRingProps}
            style={({ pressed }) => [styles.scheduleBtn, pressed ? styles.pressed : null]}
          >
            <Icon icon={iconMap.Calendar} size={17} color={th.colors.onAccent} />
            <Text style={styles.scheduleText}>{t("schedule.button")}</Text>
          </Pressable>
          <Text style={styles.footnote}>{t("schedule.footnote")}</Text>
        </>
      ) : (
        <View style={styles.linkFallback}>
          <Text style={styles.linkLabel}>{t("schedule.link_label")}</Text>
          <View style={styles.linkRow}>
            <Text style={[styles.linkUrl, webSelectableText]}>{SCHEDULE_CALL_URL}</Text>
            {clipboard ? (
              <Pressable
                onPress={onCopyLink}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("schedule.copy_a11y")}
                {...focusRingProps}
                style={({ pressed }) => [styles.copyBtn, pressed ? styles.pressed : null]}
              >
                <Icon icon={iconMap.Copy} size={14} color={th.colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </ScrollView>
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
    gap: t.space["3"],
  },

  explainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["3"],
    backgroundColor: t.colors.sky["50"],
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.sky["100"],
    padding: t.space["3"] + 1,
  },
  explainerIcon: {
    width: 32,
    height: 32,
    borderRadius: t.radius.md,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.neutral.card,
  },
  explainerText: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: t.colors.textMuted,
  },

  sectionLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
    marginTop: t.space["1"],
  },
  criteria: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 15,
    lineHeight: 21,
    color: t.colors.text,
  },

  examples: {
    gap: t.space["2"],
    marginTop: t.space["1"],
  },
  examplesHint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  exampleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  exampleCheck: {
    width: 22,
    height: 22,
    borderRadius: 7,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.moss["50"],
  },
  exampleText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 14,
    color: t.colors.text,
  },

  scheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    height: 52,
    marginTop: t.space["3"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.brand.bloom,
    ...t.shadows.pin,
  },
  scheduleText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 15,
    color: t.colors.onAccent,
  },
  footnote: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    textAlign: "center",
  },
  linkFallback: {
    gap: 4,
    marginTop: t.space["3"],
  },
  linkLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textMuted,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  linkUrl: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.mono,
    fontSize: 11,
    color: t.colors.textSubtle,
  },
  copyBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  pressed: {
    opacity: 0.9,
  },
}))
