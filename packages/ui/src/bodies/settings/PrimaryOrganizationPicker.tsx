import React, { useCallback } from "react"
import {
  View,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { focusRingProps, makeThemedStyles, useTheme } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { Avatar, SettingsSection, useToast } from "../../primitives"
import {
  actableOrganizations,
  useAuthState,
  useMyOrganizations,
  useUpdatePrivacySettings,
  type PrivacySettingsVars,
} from "../../data"
import { useT } from "../../i18n"

const PRIMARY_ORGANIZATION_AUTOMATIC = "automatic"

function pendingPrimaryOrgId(isPending: boolean, variables: PrivacySettingsVars | undefined): string | null {
  if (!isPending || typeof variables !== "object" || variables === null) return null
  if (!("primaryOrganizationId" in variables)) return null
  return variables.primaryOrganizationId ?? PRIMARY_ORGANIZATION_AUTOMATIC
}

function OptionRow({
  label,
  sub,
  logoName,
  logoSeed,
  logoUrl,
  selected,
  pending,
  onSelect,
}: {
  label: string
  sub?: string
  logoName?: string
  logoSeed?: string
  logoUrl?: string | null
  selected: boolean
  pending: boolean
  onSelect: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, busy: pending }}
      aria-checked={selected}
      aria-busy={pending}
      accessibilityLabel={label}
      {...focusRingProps}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      {logoName ? (
        <Avatar
          name={logoName}
          seed={logoSeed ?? logoName}
          photoUrl={logoUrl ?? null}
          size={28}
          style={styles.logo}
          decorative
        />
      ) : (
        <View style={styles.logoPlaceholder}>
          <Icon icon={iconMap.Building2} size={16} color={th.colors.textSubtle} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, selected ? styles.rowLabelSelected : null]} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {pending ? (
          <ActivityIndicator size="small" color={th.colors.brand.bloom} />
        ) : selected ? (
          <Icon icon={iconMap.Check} size={18} color={th.colors.brand.bloom} />
        ) : null}
      </View>
    </Pressable>
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
        <OptionRow
          label={t("affiliation.automatic")}
          sub={t("affiliation.automatic_sub")}
          selected={current === null}
          pending={pendingId === PRIMARY_ORGANIZATION_AUTOMATIC}
          onSelect={() => onSelect(null)}
        />
        {rows.map((org) => (
          <React.Fragment key={org.id}>
            <View style={styles.divider} />
            <OptionRow
              label={org.name}
              logoName={org.name}
              logoSeed={org.id}
              logoUrl={org.logoUrl ?? null}
              selected={current === org.id}
              pending={pendingId === org.id}
              onSelect={() => onSelect(org.id)}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: 56,
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["3"],
  },
  rowPressed: {
    opacity: 0.7,
  },
  logo: {
    borderRadius: t.radius.xs,
  },
  logoPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: t.radius.xs,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  rowLabelSelected: {
    fontFamily: t.fontFamily.bodyBold,
  },
  rowSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
    marginTop: 2,
  },
  trailing: {
    width: 24,
    height: 24,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
}))
