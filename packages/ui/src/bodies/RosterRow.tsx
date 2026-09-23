import React, { useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { PersonDTO } from "@civfix/shared"
import { DELETED_USER_LABEL } from "@civfix/shared"
import { makeThemedStyles, useTheme, webTransition, webHover, webCursorPointer, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { Avatar, OrgAffiliationBadge, PopoverMenu, usePopoverAnchor, VerifiedBadge } from "../primitives"
import type { PopoverMenuItem, AnchorRect } from "../primitives"

export interface RosterRowMenu {
  a11yLabel: string
  buildItems: (goToConfirm: (step: string) => void) => PopoverMenuItem[]
  confirmSteps?: Record<string, PopoverMenuItem[]>
}

export interface RosterRowProps {
  person: PersonDTO
  onOpenPerson: (navId: string) => void
  openA11yLabel: string
  nameSuffix?: React.ReactNode
  trailing?: React.ReactNode
  menu?: RosterRowMenu | null
}

const AVATAR_SIZE = 40
const CLOSED = "closed"
const ACTIONS = "actions"

export function RosterRow({
  person,
  onOpenPerson,
  openA11yLabel,
  nameSuffix,
  trailing,
  menu,
}: RosterRowProps) {
  const styles = useStyles()
  const th = useTheme()
  const [menuStep, setMenuStep] = useState<string>(CLOSED)
  const [menuRect, setMenuRect] = useState<AnchorRect | null>(null)
  const { ref: menuAnchorRef, measure: measureMenu } = usePopoverAnchor(setMenuRect)

  if (person.deleted) {
    return (
      <View style={styles.row}>
        <Avatar name={DELETED_USER_LABEL} seed={person.id} size={AVATAR_SIZE} />
        <View style={styles.meta}>
          <Text style={styles.deletedName} numberOfLines={1}>
            {DELETED_USER_LABEL}
          </Text>
        </View>
      </View>
    )
  }

  const navId = person.handle ?? person.id
  const actionItems = menu ? menu.buildItems(setMenuStep) : []
  const hasKebab = actionItems.length > 0
  const confirmSteps = menu?.confirmSteps ?? {}

  const openMenu = () => {
    measureMenu()
    setMenuStep(ACTIONS)
  }

  return (
    <View style={styles.rowOuter}>
      <Pressable
        onPress={() => onOpenPerson(navId)}
        accessibilityRole="button"
        accessibilityLabel={openA11yLabel}
        {...focusRingProps}
        style={({ pressed }) => [styles.rowMain, pressed ? styles.rowPressed : null]}
      >
        <Avatar
          name={person.name}
          seed={person.id}
          photoUrl={person.avatarUrl}
          gradient={person.avatar ?? null}
          size={AVATAR_SIZE}
        />
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {person.name}
            </Text>
            {person.official ? <VerifiedBadge size="sm" /> : null}
            {person.organization ? (
              <OrgAffiliationBadge organization={person.organization} size="sm" interactive={false} />
            ) : null}
            {nameSuffix}
          </View>
          {person.handle ? (
            <Text style={styles.handle} numberOfLines={1}>
              @{person.handle}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {trailing}
      {hasKebab ? (
        <Pressable
          ref={menuAnchorRef}
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={menu?.a11yLabel ?? ""}
          accessibilityState={{ expanded: menuStep !== CLOSED }}
          hitSlop={6}
          {...focusRingProps}
          style={(state) => [
            styles.kebab,
            webTransition,
            webCursorPointer,
            webHover(state) ? styles.kebabHovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.Ellipsis} size={18} color={th.colors.textSubtle} />
        </Pressable>
      ) : null}
      {hasKebab ? (
        <>
          <PopoverMenu
            visible={menuStep === ACTIONS}
            anchorRect={menuRect}
            onClose={() => setMenuStep(CLOSED)}
            items={actionItems}
          />
          {Object.entries(confirmSteps).map(([step, items]) => (
            <PopoverMenu
              key={step}
              visible={menuStep === step}
              anchorRect={menuRect}
              onClose={() => setMenuStep(CLOSED)}
              items={items}
            />
          ))}
        </>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  rowOuter: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  rowPressed: {
    opacity: 0.7,
  },
  kebab: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: t.space["2"],
  },
  kebabHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  pressed: {
    opacity: 0.55,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
  },
  name: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  deletedName: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["15"],
    color: t.colors.textSubtle,
  },
  handle: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
}))
