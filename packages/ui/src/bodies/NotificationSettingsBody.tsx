import { Pressable, StyleSheet, View } from "react-native"
import type { NotificationCategory, NotificationCategorySetting } from "@civfix/contract"
import {
  a11yState,
  DISABLED_OPACITY,
  focusRingProps,
  makeThemedStyles,
  MIN_TOUCH_TARGET,
  useTheme,
  webCursor,
  webHover,
} from "../theme"
import { Icon, iconMap, Text } from "../typography"
import {
  EmptyState,
  SecondaryButton,
  SignInPrompt,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
} from "../primitives"
import { ToggleRowContent } from "../primitives/ToggleRowContent"
import { CheckboxBox } from "../primitives/CheckboxBox"
import { useAuthState, useRequireAuth } from "../data"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { SectionEyebrow } from "./profile/SectionHeadings"
import { useNotificationSettingsPage, type PushBanner } from "./notificationSettings/useNotificationSettingsPage"

const SKELETON_SECTIONS = [
  { section: "reports", rows: 2 },
  { section: "messages", rows: 3 },
  { section: "events", rows: 3 },
] as const

export function NotificationSettingsBody() {
  const styles = useStyles()
  const th = useTheme()
  const { ScrollView } = useScrollHost()
  const { t } = useT("notifications-prefs")
  const { isAuthenticated, isPending } = useAuthState()
  const requireAuth = useRequireAuth()
  const page = useNotificationSettingsPage()
  const settings = page.settings

  if (!isAuthenticated && !isPending) {
    return (
      <View style={styles.stateFill}>
        <SignInPrompt
          icon={iconMap.Bell}
          iconSize={32}
          variant="detail"
          title={t("signedOut.title")}
          body={t("signedOut.body")}
          onSignIn={() => requireAuth(() => {}, { next: "/notifications/prefs" })}
        />
      </View>
    )
  }
  if (isPending || page.query.isLoading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {SKELETON_SECTIONS.map(({ section, rows }, i) => (
          <SkeletonGroup key={section} style={i > 0 ? styles.sectionGap : null}>
            <SkeletonText width="28%" height={11} style={styles.skeletonLabel} />
            <SkeletonList rows={rows} kind="settings" />
          </SkeletonGroup>
        ))}
      </ScrollView>
    )
  }
  if (page.query.isError || !settings) {
    return (
      <View style={styles.stateFill}>
        <EmptyState
          variant="detail"
          tone="neutral"
          icon={iconMap.CloudOff}
          iconColor={th.colors.textSubtle}
          iconSize={30}
          title={t("error.title")}
          body={t("error.body")}
        />
      </View>
    )
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <PushOffBanner banner={page.pushBanner} showHelp={page.showSiteSettingsHelp} onTurnOn={page.turnOnPush} />
      {page.emailDisabled ? (
        <View style={styles.emailNote}>
          <Icon icon={iconMap.Mail} size={16} color={th.colors.textMuted} />
          <Text variant="caption" style={styles.emailNoteText}>
            {t("email_unavailable")}
          </Text>
        </View>
      ) : null}
      {page.sections.map((section, i) => (
        <View key={section.id} style={i > 0 || page.pushBanner !== "none" || page.emailDisabled ? styles.sectionGap : null}>
          <View style={styles.sectionLabelRow}>
            <SectionEyebrow inline>{t(`sections.${section.id}`)}</SectionEyebrow>
          </View>
          <View style={styles.group}>
            {section.categories.map((category) => (
              <CategoryCard
                key={category}
                category={category}
                setting={settings.categories[category]}
                pushDisabled={page.pushDisabled}
                emailDisabled={page.emailDisabled}
                onChange={page.change}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

function PushOffBanner({
  banner,
  showHelp,
  onTurnOn,
}: {
  banner: PushBanner
  showHelp: boolean
  onTurnOn: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("notifications-prefs")
  if (banner === "none") return null
  const unsupported = banner === "unsupported"
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <View style={styles.bannerIcon}>
        <Icon icon={iconMap.BellOff} size={20} color={th.colors.sun["700"]} />
      </View>
      <View style={styles.bannerText}>
        <Text variant="bodyStrong">{unsupported ? t("push_off.unsupported") : t("push_off.title")}</Text>
        {showHelp ? (
          <Text variant="caption" style={styles.bannerHelp}>
            {t("push_off.site_settings")}
          </Text>
        ) : null}
      </View>
      {unsupported || showHelp ? null : (
        <SecondaryButton size="sm" label={t("push_off.turn_on")} onPress={onTurnOn} />
      )}
    </View>
  )
}

// D1 gives these two no helper line.
const WITHOUT_HELPER: ReadonlySet<NotificationCategory> = new Set(["followers", "likesAndReposts"])

function CategoryCard({
  category,
  setting,
  pushDisabled,
  emailDisabled,
  onChange,
}: {
  category: NotificationCategory
  setting: NotificationCategorySetting
  pushDisabled: boolean
  emailDisabled: boolean
  onChange: (category: NotificationCategory, change: Partial<NotificationCategorySetting>) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("notifications-prefs")
  const label = t(`category.${category}.label`)
  const helper = WITHOUT_HELPER.has(category) ? undefined : t(`category.${category}.helper`)
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <ToggleRowContent
          label={label}
          hint={helper}
          value={setting.enabled}
          onValueChange={(enabled) => onChange(category, { enabled })}
          columnStyle={styles.textCol}
        >
          <Text variant="bodyStrong">{label}</Text>
          {helper ? (
            <Text variant="caption" style={styles.helper}>
              {helper}
            </Text>
          ) : null}
        </ToggleRowContent>
      </View>
      {category === "events" && !setting.enabled ? (
        <View style={styles.warning}>
          <Icon icon={iconMap.TriangleAlert} size={16} color={th.colors.sun["700"]} />
          <Text variant="caption" style={styles.warningText}>
            {t("events_off_warning")}
          </Text>
        </View>
      ) : null}
      {setting.enabled ? (
        <View style={styles.channels}>
          <ChannelCheckbox
            channel="push"
            category={label}
            checked={setting.push}
            disabled={pushDisabled}
            onChange={(push) => onChange(category, { push })}
          />
          <ChannelCheckbox
            channel="email"
            category={label}
            checked={setting.email}
            disabled={emailDisabled}
            onChange={(email) => onChange(category, { email })}
          />
        </View>
      ) : null}
    </View>
  )
}

function ChannelCheckbox({
  channel,
  category,
  checked,
  disabled,
  onChange,
}: {
  channel: "push" | "email"
  category: string
  checked: boolean
  disabled: boolean
  onChange: (next: boolean) => void
}) {
  const styles = useStyles()
  const { t } = useT("notifications-prefs")
  const name = t(`channel.${channel}`)
  return (
    <Pressable
      onPress={disabled ? undefined : () => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={t("channel.a11y", { channel: name, category })}
      {...a11yState({ checked, disabled })}
      {...focusRingProps}
      style={(state) => [
        styles.channel,
        disabled ? styles.channelDisabled : webCursor(),
        !disabled && webHover(state) ? styles.channelHovered : null,
      ]}
    >
      <CheckboxBox checked={checked} />
      <Text variant="label">{name}</Text>
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  stateFill: { flex: 1 },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: t.space["3"],
  },
  sectionGap: { marginTop: t.space["6"] },
  skeletonLabel: { marginBottom: t.space["3"] },
  group: { gap: t.space["3"] },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    padding: t.space["3"],
    borderRadius: t.radius.md,
    backgroundColor: t.colors.sun["50"],
  },
  bannerIcon: {
    width: t.space["10"],
    height: t.space["10"],
    borderRadius: t.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surface,
  },
  bannerText: { flex: 1, minWidth: 0 },
  bannerHelp: { marginTop: t.space["1"] },

  emailNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    marginTop: t.space["3"],
    paddingHorizontal: t.space["1"],
  },
  emailNoteText: { flex: 1 },

  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    overflow: "hidden",
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
    minHeight: 56,
  },
  textCol: { flex: 1, marginRight: t.space["3"] },
  helper: { marginTop: 2, lineHeight: 16 },

  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["2"],
    marginHorizontal: t.space["4"],
    marginBottom: t.space["3"],
    padding: t.space["2"],
    borderRadius: t.radius.sm,
    backgroundColor: t.colors.sun["50"],
  },
  warningText: { flex: 1, color: t.colors.sun["700"] },

  channels: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  channel: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: t.space["2"],
    paddingRight: t.space["4"],
    borderRadius: t.radius.sm,
  },
  channelHovered: { backgroundColor: t.colors.surfaceTint },
  channelDisabled: { opacity: DISABLED_OPACITY },
}))
