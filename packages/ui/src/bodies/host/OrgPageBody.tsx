import React, { useCallback, useMemo } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { OrganizationDTO } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  useLayoutMode,
  useTheme,
  webCursor,
  webHover,
  webTransition,
} from "../../theme"
import { Text, TextLink, Icon, iconMap } from "../../typography"
import {
  Avatar,
  DonateBlock,
  EventCard,
  Markdown,
  SecondaryButton,
  SocialLinksRow,
  presentSocialPlatforms,
  shareLink,
  useToast,
} from "../../primitives"
import { orgPagePath } from "../../primitives/externalUrls"
import { useOpenExternal } from "../../capabilities"
import {
  organizationEventRows,
  useOrganization,
  useOrganizationEvents,
  type OrganizationEventsWindow,
} from "../../data/hooks/orgs"
import { useLocale, useT } from "../../i18n"
import { useNavStore } from "../../nav/useNavStore"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { formatHoursDisplay } from "../formatHours"
import { canOpenOrgManage } from "./orgManageModel"

function OrgHeader({ org, onShare }: { org: OrganizationDTO; onShare: () => void }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-org")
  return (
    <View style={styles.header}>
      <Avatar name={org.name} seed={org.id} photoUrl={org.logoUrl ?? null} size={72} />
      <View style={styles.headerMeta}>
        <Text style={styles.name} numberOfLines={2}>
          {org.name}
        </Text>
        <Text style={styles.slug}>{t("header.slug", { slug: org.slug })}</Text>
        {org.verifiedStatus === "verified" && org.verifiedKind ? (
          <Text style={styles.verified}>{t(`enums:orgVerificationKind.${org.verifiedKind}`)}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel={t("actions.share_a11y")}
        hitSlop={6}
        {...focusRingProps}
        style={({ pressed }) => [styles.headerBtn, pressed ? styles.headerBtnPressed : null]}
      >
        <Icon icon={iconMap.Share} size={17} color={th.colors.text} />
      </Pressable>
    </View>
  )
}

function OrgEventsSection({
  slug,
  when,
}: {
  slug: string
  when: OrganizationEventsWindow
}) {
  const styles = useStyles()
  const { t } = useT("host-org")
  const push = useNavStore((state) => state.push)
  const query = useOrganizationEvents(slug, when)
  const rows = useMemo(
    () => organizationEventRows(query.data?.pages),
    [query.data?.pages],
  )

  const body = query.isLoading ? (
    <Text style={styles.muted}>{t("events.loading")}</Text>
  ) : query.isError ? (
    <Text style={styles.muted}>{t("events.error")}</Text>
  ) : rows.length === 0 ? (
    <Text style={styles.muted}>
      {when === "upcoming" ? t("events.empty_upcoming") : t("events.empty_past")}
    </Text>
  ) : (
    <>
      {rows.map((cleanup) => (
        <EventCard
          key={cleanup.id}
          cleanup={cleanup}
          onPress={() => push({ kind: "cleanup", id: cleanup.id })}
        />
      ))}
      {query.hasNextPage ? (
        <TextLink
          variant="label"
          standalone
          onPress={() => {
            void query.fetchNextPage()
          }}
          accessibilityLabel={
            when === "upcoming"
              ? t("events.load_more_upcoming_a11y")
              : t("events.load_more_past_a11y")
          }
        >
          {query.isFetchingNextPage ? t("events.loading_more") : t("events.load_more")}
        </TextLink>
      ) : null}
    </>
  )

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {when === "upcoming" ? t("events.upcoming") : t("events.past")}
      </Text>
      {body}
    </View>
  )
}

export function OrgPageBody({ slug }: { slug: string }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-org")
  const { locale } = useLocale()
  const { ScrollView } = useScrollHost()
  const toast = useToast()
  const openExternal = useOpenExternal()
  const compact = useLayoutMode() === "compact"

  const query = useOrganization(slug)
  const org = query.data ?? null

  const socials = useMemo(() => presentSocialPlatforms(org?.socialLinks), [org?.socialLinks])

  const websiteUrl =
    org?.websiteUrl && org.websiteUrl.startsWith("https://") ? org.websiteUrl : null

  const onShare = useCallback(() => {
    if (!org) return
    void shareLink({ title: org.name, path: orgPagePath(org.slug) }).then((result) => {
      if (result !== "copied") return
      toast.show(t("common-share:button.copied"), { variant: "success" })
    })
  }, [org, t, toast])

  const openUrl = useCallback(
    (url: string) => {
      void openExternal?.open(url)
    },
    [openExternal],
  )

  if (query.isLoading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.muted}>{t("state.loading")}</Text>
      </ScrollView>
    )
  }

  if (query.isError || !org) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <OrgHeader org={org} onShare={onShare} />

      {canOpenOrgManage(org) ? (
        <View style={styles.manageRow}>
          <SecondaryButton
            size={compact ? "md" : "sm"}
            icon={iconMap.Settings}
            label={t("manage.action")}
            accessibilityLabel={t("manage.action_a11y", { name: org.name })}
            onPress={() => useNavStore.getState().push({ kind: "org-manage", slug: org.slug })}
            {...(compact ? { style: styles.manageBlock } : {})}
          />
        </View>
      ) : null}

      {org.description ? (
        <View style={styles.section}>
          <Markdown source={org.description} />
        </View>
      ) : null}

      {websiteUrl || socials.length > 0 ? (
        <View style={styles.links}>
          {websiteUrl ? (
            <Pressable
              onPress={() => openUrl(websiteUrl)}
              accessibilityRole="link"
              accessibilityLabel={t("links.website_a11y")}
              {...focusRingProps}
              style={(state) => [
                styles.linkChip,
                webTransition,
                webCursor(),
                webHover(state) ? styles.linkChipHovered : null,
              ]}
            >
              <Icon icon={iconMap.Globe} size={14} color={th.colors.textMuted} />
              <Text style={styles.linkText}>{t("links.website")}</Text>
            </Pressable>
          ) : null}
          <SocialLinksRow links={org.socialLinks} />
        </View>
      ) : null}

      <View style={styles.statsRow}>
        {org.eventCount != null ? (
          <Text style={styles.stat}>{t("stats.events", { count: org.eventCount })}</Text>
        ) : null}
        {org.memberCount != null ? (
          <Text style={styles.stat}>{t("stats.members", { count: org.memberCount })}</Text>
        ) : null}
        {org.volunteerHours != null && org.volunteerHours > 0 ? (
          <Text style={styles.stat}>
            {t("stats.hours", { hours: formatHoursDisplay(org.volunteerHours, locale) })}
          </Text>
        ) : null}
        {org.volunteerCount != null && org.volunteerCount > 0 ? (
          <Text style={styles.stat}>{t("stats.volunteers", { count: org.volunteerCount })}</Text>
        ) : null}
      </View>

      <OrgEventsSection slug={slug} when="upcoming" />
      <OrgEventsSection slug={slug} when="past" />

      <DonateBlock url={org.donationUrl} ownerName={org.name} />
    </ScrollView>
  )
}

const MIN_TOUCH_TARGET = 44

const SHARE_BUTTON_SIZE = 36

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["10"],
    gap: t.space["4"],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  headerMeta: {
    flex: 1,
    minWidth: 0,
  },
  headerBtn: {
    width: SHARE_BUTTON_SIZE,
    height: SHARE_BUTTON_SIZE,
    borderRadius: t.radius.pill,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
  headerBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
  name: {
    flexShrink: 1,
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["20"],
    color: t.colors.text,
  },
  slug: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    marginTop: 2,
  },
  verified: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.moss["700"],
    marginTop: 2,
  },
  section: {
    gap: t.space["2"],
  },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  manageBlock: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
  },
  linkChip: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  linkChipHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  linkText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["4"],
  },
  stat: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  muted: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
}))
