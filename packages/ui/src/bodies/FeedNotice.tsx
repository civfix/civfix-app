import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { StyleProp, TextStyle } from "react-native"
import { focusRingProps, makeThemedStyles, wash, useTheme } from "../theme"
import { Icon, iconMap, Text, TextLink } from "../typography"

export interface FeedNoticeLink {
  before: string
  label: string
  after: string
  onPress: () => void
}

export interface FeedNoticeProps {
  icon: keyof typeof iconMap
  title: string
  body?: string
  link?: FeedNoticeLink
  actionLabel?: string
  onAction?: () => void
  plain?: boolean
}

function NoticeCopy({
  body,
  link,
  linkStyle,
}: {
  body?: string
  link?: FeedNoticeLink
  linkStyle?: StyleProp<TextStyle>
}) {
  if (!link) return <>{body}</>
  return (
    <>
      {link.before}
      <TextLink onPress={link.onPress} style={linkStyle}>
        {link.label}
      </TextLink>
      {link.after}
    </>
  )
}

export function FeedNotice({
  icon,
  title,
  body,
  link,
  actionLabel,
  onAction,
  plain = false,
}: FeedNoticeProps) {
  const styles = useStyles()
  const t = useTheme()
  if (plain) {
    return (
      <View style={styles.plainNotice}>
        <Text variant="title" style={styles.plainTitle}>
          {title}
        </Text>
        <Text variant="body" color={t.colors.textMuted} style={styles.plainBody}>
          <NoticeCopy body={body} link={link} />
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            {...focusRingProps}
            style={({ pressed }) => [styles.plainAction, pressed ? styles.actionPressed : null]}
          >
            <Text style={styles.noticeActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }
  return (
    <View style={styles.notice}>
      <View style={styles.noticeIcon}>
        <Icon icon={iconMap[icon]} size={18} color={t.colors.brand.bloom} />
      </View>
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Text style={styles.noticeBody}>
          <NoticeCopy body={body} link={link} linkStyle={styles.noticeLinkSize} />
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            {...focusRingProps}
            style={({ pressed }) => [styles.noticeAction, pressed ? styles.actionPressed : null]}
          >
            <Text style={styles.noticeActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const MIN_TOUCH_TARGET = 44

const useStyles = makeThemedStyles((t) => ({
  actionPressed: { opacity: 0.82, transform: [{ scale: 0.93 }] },
  notice: { flexDirection: "row", gap: t.space["3"], borderRadius: 24, backgroundColor: t.colors.neutral.card, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border, ...t.shadows.s1 },
  noticeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: wash(t.colors.brand.bloom, 0.88, t) },
  noticeCopy: { flex: 1, gap: 2 },
  noticeTitle: { fontFamily: t.fontFamily.bodyBold, fontSize: 14, lineHeight: 20, color: t.colors.text },
  noticeBody: { fontFamily: t.fontFamily.bodyRegular, fontSize: 12.5, lineHeight: 18, color: t.colors.textMuted },
  noticeLinkSize: { fontSize: 12.5, lineHeight: 18 },
  plainNotice: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: t.space["8"], paddingVertical: t.space["10"], gap: t.space["2"] },
  plainTitle: { textAlign: "center" },
  plainBody: { textAlign: "center", lineHeight: 20, maxWidth: 300 },
  plainAction: { alignSelf: "center", minHeight: MIN_TOUCH_TARGET, justifyContent: "center", paddingHorizontal: 12, marginTop: t.space["2"], borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceTint },
  noticeAction: { alignSelf: "flex-start", minHeight: MIN_TOUCH_TARGET, justifyContent: "center", paddingHorizontal: 12, marginTop: 6, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceTint },
  noticeActionText: { fontFamily: t.fontFamily.bodyBold, fontSize: 12.5, lineHeight: 17, color: t.colors.accentText },
}))
