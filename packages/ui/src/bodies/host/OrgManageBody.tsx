import React, { useCallback, useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import type { SocialPlatform } from "@civfix/shared"
import {
  MAX_ORG_DESCRIPTION,
  MAX_ORG_NAME,
  SAFE_HTTPS_LINK_MAX,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
} from "@civfix/shared"
import {
  focusRingProps,
  headingLevel,
  makeThemedStyles,
  MIN_TOUCH_TARGET,
  webCursor,
} from "../../theme"
import { Text } from "../../typography"
import {
  Avatar,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  SkeletonGroup,
  useToast,
} from "../../primitives"
import { useApi } from "../../data/context"
import { useCamera } from "../../capabilities"
import { uploadMedia } from "../../data/uploadMedia"
import { useOrganization, useUpdateOrganization } from "../../data/hooks/orgs"
import { useT } from "../../i18n"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { appErrorCode, appErrorFields } from "../../data/errorCode"
import { RowsSkeleton } from "./HostSkeletons"
import { CollaboratorsSection } from "./dashboard/CollaboratorsSection"
import { OrgField } from "./OrgField"
import {
  SOCIAL_PREFIX,
  canOpenOrgManage,
  linksDirty,
  linksDraftFrom,
  linksErrors,
  linksPayload,
  orgLogoErrorKey,
  orgManageErrorKey,
  profileDirty,
  profileDraftFrom,
  profileErrors,
  profilePayload,
  socialHandleMax,
  type OrgLinksDraft,
  type OrgProfileDraft,
} from "./orgManageModel"

const LOGO_SIZE = 96

const GHOST_MIN_HEIGHT = 28

const HTTPS_PLACEHOLDER = "https://"

const GHOST_SLOP_Y = (MIN_TOUCH_TARGET - GHOST_MIN_HEIGHT) / 2

const GHOST_HIT_SLOP = { top: GHOST_SLOP_Y, bottom: GHOST_SLOP_Y }

export function OrgManageBody({ slug }: { slug: string }) {
  const styles = useStyles()
  const { t } = useT("host-org")
  const { ScrollView } = useScrollHost()
  const toast = useToast()
  const api = useApi()
  const camera = useCamera()

  const query = useOrganization(slug)
  const org = query.data ?? null
  const save = useUpdateOrganization(slug)

  const initialProfile = useMemo(() => profileDraftFrom(org), [org])
  const initialLinks = useMemo(() => linksDraftFrom(org), [org])
  const [profile, setProfile] = useState<OrgProfileDraft>(initialProfile)
  const [links, setLinks] = useState<OrgLinksDraft>(initialLinks)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState<Record<string, boolean>>({})
  const [seededOrgId, setSeededOrgId] = useState<string | null>(org?.id ?? null)

  // Drafts seed once per org: a save of one section, or any refetch, rebuilds `org` and must not
  // wipe unsaved edits in the other section.
  const orgId = org?.id ?? null
  if (orgId !== seededOrgId) {
    setSeededOrgId(orgId)
    setProfile(initialProfile)
    setLinks(initialLinks)
    setLogoPreview(null)
  }

  const profileProblems = profileErrors(profile)
  const linkProblems = linksErrors(links)
  const profileChanged = profileDirty(profile, initialProfile)
  const linksChanged = linksDirty(links, initialLinks)

  const onError = useCallback(
    (err: unknown) => {
      toast.show(t(orgManageErrorKey(appErrorCode(err), appErrorFields(err))), { variant: "error" })
    },
    [t, toast],
  )

  const saveProfile = useCallback(() => {
    if (!org) return
    setShowErrors((current) => ({ ...current, profile: true }))
    if (Object.keys(profileProblems).length > 0) return
    save.mutate(profilePayload(org.id, profile), {
      onSuccess: (updated) => {
        setProfile(profileDraftFrom(updated))
        setLogoPreview(null)
        toast.show(t("manage.saved"), { variant: "success" })
      },
      onError,
    })
  }, [onError, org, profile, profileProblems, save, t, toast])

  const saveLinks = useCallback(() => {
    if (!org) return
    setShowErrors((current) => ({ ...current, links: true }))
    if (Object.keys(linkProblems).length > 0) return
    save.mutate(linksPayload(org.id, links), {
      onSuccess: (updated) => {
        setLinks(linksDraftFrom(updated))
        toast.show(t("manage.saved"), { variant: "success" })
      },
      onError,
    })
  }, [linkProblems, links, onError, org, save, t, toast])

  const pickLogo = useCallback(() => {
    if (uploading) return
    void (async () => {
      setUploading(true)
      try {
        const picked = await camera.pickFromLibrary()
        if (!picked || picked.kind !== "image") return
        const uploaded = await uploadMedia({ api, camera, media: picked })
        setProfile((current) => ({ ...current, logoMediaId: uploaded.mediaId }))
        setLogoPreview(picked.uri)
      } catch (err) {
        toast.show(t(orgLogoErrorKey(appErrorCode(err))), { variant: "error" })
      } finally {
        setUploading(false)
      }
    })()
  }, [api, camera, t, toast, uploading])

  if (query.isPending) {
    return (
      <View style={styles.padded}>
        <SkeletonGroup>
          <RowsSkeleton rows={4} />
        </SkeletonGroup>
      </View>
    )
  }

  if (query.isError || !org) {
    return (
      <View style={styles.fill}>
        <FeedNotice
          plain
          icon="CloudOff"
          title={t("state.error_title")}
          body={t("state.error_body")}
          actionLabel={t("manage.retry")}
          onAction={() => void query.refetch()}
        />
      </View>
    )
  }

  if (!canOpenOrgManage(org)) {
    return (
      <View style={styles.fill}>
        <FeedNotice
          plain
          icon="Lock"
          title={t("manage.denied_title")}
          body={t("manage.denied_body")}
        />
      </View>
    )
  }

  const problem = (section: "profile" | "links", field: string): string | undefined => {
    if (!showErrors[section]) return undefined
    const key = section === "profile" ? profileProblems[field] : linkProblems[field]
    return key ? t(key) : undefined
  }

  const fieldState = (id: string) => ({
    id,
    editable: !save.isPending,
    focused: focused === id,
    onFocusChange: setFocused,
  })

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.scrollBody}>
        <View style={styles.header}>
          <Text variant="title" accessibilityRole="header" {...headingLevel(1)}>
            {t("manage.title")}
          </Text>
          <Text variant="caption">{t("manage.handle_locked", { slug: org.slug })}</Text>
        </View>

        <SectionCard label={t("manage.profile_section")}>
          <View style={styles.logoRow}>
            <Avatar
              name={profile.name || org.name}
              seed={org.id}
              photoUrl={logoPreview ?? org.logoUrl ?? null}
              size={LOGO_SIZE}
              decorative
            />
            <View style={styles.logoActions}>
              <SecondaryButton
                size="sm"
                label={uploading ? t("manage.logo_uploading") : t("manage.logo_change")}
                onPress={pickLogo}
                disabled={uploading || save.isPending}
              />
              {profile.logoMediaId ? (
                <Pressable
                  onPress={() => {
                    setProfile((current) => ({ ...current, logoMediaId: null }))
                    setLogoPreview(null)
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("manage.logo_remove")}
                  hitSlop={GHOST_HIT_SLOP}
                  {...focusRingProps}
                  style={(state) => [styles.ghost, webCursor(), state.pressed ? styles.pressed : null]}
                >
                  <Text style={styles.ghostText}>{t("manage.logo_remove")}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <OrgField
            {...fieldState("name")}
            value={profile.name}
            onChange={(name) => setProfile((c) => ({ ...c, name }))}
            label={t("manage.name")}
            max={MAX_ORG_NAME}
            error={problem("profile", "name")}
          />

          <OrgField
            {...fieldState("description")}
            value={profile.description}
            onChange={(description) => setProfile((c) => ({ ...c, description }))}
            label={t("manage.description")}
            max={MAX_ORG_DESCRIPTION}
            multiline
            hint={t("manage.description_hint")}
          />

          {profileChanged ? (
            <View style={styles.saveBar}>
              <SecondaryButton
                size="sm"
                label={t("manage.discard")}
                onPress={() => {
                  setProfile(initialProfile)
                  setLogoPreview(null)
                }}
                disabled={save.isPending}
              />
              <PrimaryButton
                label={t("manage.save")}
                onPress={saveProfile}
                loading={save.isPending}
              />
            </View>
          ) : null}
        </SectionCard>

        <SectionCard label={t("manage.links_section")}>
          <OrgField
            {...fieldState("websiteUrl")}
            value={links.websiteUrl}
            onChange={(websiteUrl) => setLinks((c) => ({ ...c, websiteUrl }))}
            label={t("manage.website")}
            max={SAFE_HTTPS_LINK_MAX}
            placeholder={HTTPS_PLACEHOLDER}
            hint={t("manage.https_hint")}
            error={problem("links", "websiteUrl")}
          />

          <OrgField
            {...fieldState("donationUrl")}
            value={links.donationUrl}
            onChange={(donationUrl) => setLinks((c) => ({ ...c, donationUrl }))}
            label={t("form.donationUrl")}
            max={SAFE_HTTPS_LINK_MAX}
            placeholder={HTTPS_PLACEHOLDER}
            hint={t("form.donation_hint")}
            error={problem("links", "donationUrl")}
          />

          <Text variant="caption">{t("manage.social_hint")}</Text>
          {SOCIAL_PLATFORMS.map((platform: SocialPlatform) => (
            <OrgField
              key={platform}
              {...fieldState(platform)}
              value={links[platform]}
              onChange={(next) => setLinks((c) => ({ ...c, [platform]: next }))}
              label={SOCIAL_PLATFORM_LABELS[platform]}
              max={socialHandleMax(platform)}
              prefix={SOCIAL_PREFIX[platform]}
              error={problem("links", `socialLinks.${platform}`)}
            />
          ))}

          {linksChanged ? (
            <View style={styles.saveBar}>
              <SecondaryButton
                size="sm"
                label={t("manage.discard")}
                onPress={() => setLinks(initialLinks)}
                disabled={save.isPending}
              />
              <PrimaryButton label={t("manage.save")} onPress={saveLinks} loading={save.isPending} />
            </View>
          ) : null}
        </SectionCard>

        <CollaboratorsSection org={org} />
      </View>
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  fill: {
    flex: 1,
  },
  padded: {
    padding: t.space["4"],
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  scrollBody: {
    gap: t.space["6"],
  },
  header: {
    gap: t.space["1"],
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["4"],
  },
  logoActions: {
    flex: 1,
    minWidth: 0,
    gap: t.space["2"],
    alignItems: "flex-start",
  },
  ghost: {
    minHeight: GHOST_MIN_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: t.space["2"],
    borderRadius: t.radius.sm,
  },
  pressed: {
    opacity: 0.8,
  },
  ghostText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.dangerInk,
  },
  saveBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: t.space["2"],
    marginTop: t.space["2"],
  },
}))
