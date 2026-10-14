import React, { useMemo } from "react"
import { View } from "react-native"
import type { HostPortfolioKpis, OrganizationDTO } from "@civfix/shared"
import { headingLevel, makeThemedStyles } from "../../../theme"
import { Text, iconMap, type LucideIcon } from "../../../typography"
import { Avatar, MetaDot, PopoverMenu, SecondaryButton } from "../../../primitives"
import { useAuthState } from "../../../data"
import { useT } from "../../../i18n"
import type { DashboardScope } from "./dashboardModel"
import type { ScopeMenuState } from "./useScopeMenu"

const SCOPE_AVATAR = 20

const SCOPE_MENU_SELF = "self"

const HEADER_ROW_HEIGHT = 32

const SCOPE_PILL_MAX_WIDTH = "60%"

function avatarIcon(name: string, seed: string, photoUrl: string | null): LucideIcon {
  return function ScopeAvatar() {
    return <Avatar name={name} seed={seed} photoUrl={photoUrl} size={SCOPE_AVATAR} decorative />
  }
}

export interface DashboardHeaderProps {
  scope: DashboardScope
  kpis: HostPortfolioKpis | null
  teaching: boolean
  scopeMenu: ScopeMenuState
  onCreate: () => void
}

export function DashboardHeader({ scope, kpis, teaching, scopeMenu, onCreate }: DashboardHeaderProps) {
  const styles = useStyles()
  const { t } = useT("event-dashboard")
  const { user } = useAuthState()

  const scopeName = scope.org?.name ?? t("scope.you")
  const avatarName = scope.org ? scope.org.name : (user?.displayName ?? t("scope.you"))
  const avatarSeed = scope.org ? scope.org.id : (user?.id ?? SCOPE_MENU_SELF)
  const avatarPhoto = scope.org ? (scope.org.logoUrl ?? null) : (user?.avatarUrl ?? null)
  // A new component type per render would remount the avatar image on every dashboard tick.
  const scopeIcon = useMemo(
    () => avatarIcon(avatarName, avatarSeed, avatarPhoto),
    [avatarName, avatarSeed, avatarPhoto],
  )

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text
          variant="title"
          style={styles.headerTitle}
          accessibilityRole="header"
          {...headingLevel(1)}
        >
          {t("header.title")}
        </Text>
        {teaching ? null : (
          <SecondaryButton
            size="sm"
            icon={iconMap.Plus}
            label={t("create.short")}
            accessibilityLabel={
              scope.org
                ? t("create.a11y_org", { org: scope.org.name })
                : t("create.a11y_personal")
            }
            onPress={onCreate}
          />
        )}
      </View>
      <View style={styles.headerMeta}>
        {scope.selectorVisible ? (
          <View ref={scopeMenu.anchorRef} style={styles.scopeSlot}>
            <SecondaryButton
              size="sm"
              icon={scopeIcon}
              trailingIcon={iconMap.ChevronDown}
              label={scopeName}
              accessibilityLabel={t("scope.a11y", { name: scopeName })}
              onPress={scopeMenu.show}
            />
          </View>
        ) : null}
        {scope.selectorVisible && kpis ? <MetaDot /> : null}
        {kpis ? (
          <Text variant="caption" numberOfLines={1} style={styles.headerSummary}>
            {t("header.summary", {
              upcoming: kpis.upcomingEvents,
              hosted: kpis.eventsHosted,
            })}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

export interface ScopeMenuProps {
  scopeMenu: ScopeMenuState
  orgs: readonly OrganizationDTO[]
  activeOrgId: string | null
  onSelect: (orgId: string | null) => void
}

export function ScopeMenu({ scopeMenu, orgs, activeOrgId, onSelect }: ScopeMenuProps) {
  const { t } = useT("event-dashboard")
  return (
    <PopoverMenu
      visible={scopeMenu.open}
      anchorRect={scopeMenu.rect}
      align="left"
      onClose={scopeMenu.close}
      items={[
        {
          key: SCOPE_MENU_SELF,
          label: t("scope.you"),
          accessibilityLabel: t("scope.menu_a11y"),
          ...(activeOrgId === null ? { icon: "Check" as const } : {}),
          onPress: () => {
            scopeMenu.close()
            onSelect(null)
          },
        },
        ...orgs.map((org) => ({
          key: org.id,
          label: org.name,
          ...(activeOrgId === org.id ? { icon: "Check" as const } : {}),
          onPress: () => {
            scopeMenu.close()
            onSelect(org.id)
          },
        })),
      ]}
    />
  )
}

const useStyles = makeThemedStyles((t) => ({
  header: {
    gap: t.space["2"],
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: HEADER_ROW_HEIGHT,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    minHeight: HEADER_ROW_HEIGHT,
  },
  scopeSlot: {
    flexShrink: 1,
    maxWidth: SCOPE_PILL_MAX_WIDTH,
  },
  headerSummary: {
    flexShrink: 1,
  },
}))
