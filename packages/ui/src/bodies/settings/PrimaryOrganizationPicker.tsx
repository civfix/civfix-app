import React, { useCallback } from "react"
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { Avatar, SettingsSection, useToast } from "../../primitives"
import { RadioOptionRow } from "../../primitives/RadioOptionRow"
import {
  actableOrganizations,
  useAuthState,
  useMyOrganizations,
  useUpdatePrivacySettings,
  type PrivacySettingsVars,
} from "../../data"
import { useT } from "../../i18n"

const PRIMARY_ORGANIZATION_AUTOMATIC = "automatic"
const LOGO_SIZE = 28

function pendingPrimaryOrgId(isPending: boolean, variables: PrivacySettingsVars | undefined): string | null {
  if (!isPending || typeof variables !== "object" || variables === null) return null
  if (!("primaryOrganizationId" in variables)) return null
  return variables.primaryOrganizationId ?? PRIMARY_ORGANIZATION_AUTOMATIC
}

function OrganizationLogo({
  name,
  seed,
  url,
}: {
  name: string
  seed: string
  url: string | null
}) {
  const styles = useStyles()
  return <Avatar name={name} seed={seed} photoUrl={url} size={LOGO_SIZE} style={styles.logo} decorative />
}

function PlaceholderLogo() {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={styles.logoPlaceholder}>
      <Icon icon={iconMap.Building2} size={16} color={th.colors.textSubtle} />
    </View>
  )
}

export function PrimaryOrganizationPicker({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles()
  const { t } = useT("settings-account")
  const { user } = useAuthState()
  const toast = useToast()
  const orgs = useMyOrganizations()
  const update = useUpdatePrivacySettings()
  const rows = actableOrganizations(orgs.data) ?? []
  const current = user?.primaryOrganizationId ?? null
  const pendingId = pendingPrimaryOrgId(update.isPending, update.variables)

  const onSelect = useCallback(
    (primaryOrganizationId: string | null) => {
      if (primaryOrganizationId === current || update.isPending) return
      update.mutate({ primaryOrganizationId }, {
        onError: () => toast.show(t("affiliation.error"), { variant: "error" }),
      })
    },
    [current, update, toast, t],
  )

  if (rows.length === 0) return null

  return (
    <SettingsSection label={t("section.affiliation")} style={style}>
      <Text style={styles.helper}>{t("affiliation.helper")}</Text>
      <View accessibilityRole="radiogroup" aria-label={t("affiliation.label")}>
        <RadioOptionRow
          layout="inset"
          leading={<PlaceholderLogo />}
          label={t("affiliation.automatic")}
          sub={t("affiliation.automatic_sub")}
          selected={current === null}
          pending={pendingId === PRIMARY_ORGANIZATION_AUTOMATIC}
          onPress={() => onSelect(null)}
        />
        {rows.map((org) => (
          <React.Fragment key={org.id}>
            <View style={styles.divider} />
            <RadioOptionRow
              layout="inset"
              leading={
                org.name ? (
                  <OrganizationLogo name={org.name} seed={org.id} url={org.logoUrl ?? null} />
                ) : (
                  <PlaceholderLogo />
                )
              }
              label={org.name}
              selected={current === org.id}
              pending={pendingId === org.id}
              onPress={() => onSelect(org.id)}
            />
          </React.Fragment>
        ))}
      </View>
    </SettingsSection>
  )
}

const useStyles = makeThemedStyles((t) => ({
  helper: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["3"],
  },
  logo: {
    borderRadius: t.radius.xs,
  },
  logoPlaceholder: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: t.radius.xs,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
}))
