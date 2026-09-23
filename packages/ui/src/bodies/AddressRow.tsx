import React, { useCallback, useMemo, useState } from "react"
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import type { AddressPrecision, EventKind, ReportCategory } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  useLayoutMode,
  useTheme,
  webCursorPointer,
  webHover,
  webNoSelect,
  webScrimProps,
  webTransition,
} from "../theme"
import { Icon, Text, iconMap } from "../typography"
import type { IconName } from "../typography"
import { useClipboard, useHaptics, useOpenExternal } from "../capabilities"
import { useT } from "../i18n"
import { useMapFocus } from "../map"
import { useNavStore } from "../nav"
import { useToast } from "../primitives"
import {
  addressExternalPlan,
  addressMapsOptions,
  addressRowAffordances,
  appleMapsUrl,
  applyNearPrefix,
  googleMapsUrl,
  showOnMapPlan,
  type AddressMapsOption,
  type AddressPoint,
} from "./addressRowModel"

export type AddressFocusTarget =
  | { kind: "report"; id: string; category: ReportCategory }
  | { kind: "cleanup"; id: string; eventKind: EventKind }

export interface AddressRowProps {
  address: string | null | undefined
  point?: AddressPoint | null
  focusTarget?: AddressFocusTarget | null
  precision?: AddressPrecision | null
  verified?: boolean
  fallbackLabel?: string | null
  title?: string | null
  variant?: "full" | "compact"
  numberOfLines?: number
  trailing?: React.ReactNode
}

const OPTION_ICON: Record<AddressMapsOption, IconName> = {
  apple: "Navigation",
  google: "ExternalLink",
  copy: "Copy",
}

function rowPlatform(): "ios" | "android" | "web" {
  if (Platform.OS === "web") return "web"
  return Platform.OS === "android" ? "android" : "ios"
}

function AddressActionsSheet({
  visible,
  options,
  onClose,
  onChoose,
}: {
  visible: boolean
  options: readonly AddressMapsOption[]
  onClose: () => void
  onChoose: (option: AddressMapsOption) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("address")
  const insets = React.useContext(SafeAreaInsetsContext)
  const pendingRef = React.useRef<AddressMapsOption | null>(null)

  const choose = (option: AddressMapsOption) => {
    if (Platform.OS === "ios") {
      pendingRef.current = option
      onClose()
      return
    }
    onClose()
    onChoose(option)
  }

  const onDismiss = () => {
    const pending = pendingRef.current
    pendingRef.current = null
    if (pending) onChoose(pending)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <View style={styles.sheetRoot}>
        <Pressable
          style={styles.scrim}
          accessibilityRole="button"
          accessibilityLabel={t("sheet.dismiss")}
          onPress={onClose}
          {...webScrimProps}
        />
        <View
          style={[styles.sheet, { paddingBottom: (insets?.bottom ?? 0) + th.space["3"] }]}
          accessibilityRole="menu"
          accessibilityLabel={t("sheet.title")}
        >
          {options.map((option) => (
            <Pressable
              key={option}
              onPress={() => choose(option)}
              accessibilityRole="menuitem"
              accessibilityLabel={t(`sheet.${option}`)}
              {...focusRingProps}
              style={(state) => [
                styles.sheetRow,
                webTransition,
                webCursorPointer,
                webHover(state) ? styles.sheetRowHovered : null,
                state.pressed ? styles.sheetRowHovered : null,
              ]}
            >
              <Icon icon={iconMap[OPTION_ICON[option]]} size={18} color={th.colors.text} />
              <Text
                variant="body"
                color={th.colors.text}
                numberOfLines={1}
                style={[styles.sheetLabel, webNoSelect]}
              >
                {t(`sheet.${option}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  )
}

function AddressIconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName
  label: string
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      {...focusRingProps}
      style={(state) => [
        styles.iconBtn,
        webTransition,
        webCursorPointer,
        webHover(state) ? styles.iconBtnHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <Icon icon={iconMap[icon]} size={15} color={th.colors.textSubtle} />
    </Pressable>
  )
}

export function AddressRow({
  address,
  point,
  focusTarget,
  precision,
  verified = false,
  fallbackLabel,
  title,
  variant = "full",
  numberOfLines = 2,
  trailing,
}: AddressRowProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("address")
  const clipboard = useClipboard()
  const openExternal = useOpenExternal()
  const haptics = useHaptics()
  const mode = useLayoutMode()
  const toast = useToast()
  const [sheetOpen, setSheetOpen] = useState(false)

  const near = useCallback((line: string) => t("row.near", { address: line }), [t])
  const resolved = address?.trim() ?? ""
  const line = resolved.length > 0 ? applyNearPrefix(resolved, precision, near) : null
  const display = line ?? fallbackLabel?.trim() ?? null

  const urlInput = useMemo(
    () => ({
      address: resolved.length > 0 ? resolved : null,
      point: point ?? null,
      verified,
      title: title ?? null,
    }),
    [resolved, point, verified, title],
  )
  const appleUrl = useMemo(() => appleMapsUrl(urlInput), [urlInput])
  const googleUrl = useMemo(() => googleMapsUrl(urlInput), [urlInput])

  const hasExternalPlan =
    addressExternalPlan({
      platform: rowPlatform(),
      appleUrl,
      googleUrl,
      hasCopy: false,
    }).kind !== "none"

  const affordances = addressRowAffordances({
    variant,
    hasAddress: resolved.length > 0,
    hasPoint: point != null,
    hasFocusTarget: focusTarget != null,
    hasClipboard: clipboard !== undefined,
    hasOpenExternal: openExternal !== undefined,
    hasExternalPlan,
  })

  const onCopy = useCallback(() => {
    if (!clipboard || resolved.length === 0) return
    void clipboard.setString(resolved).then(
      () => {
        haptics.success()
        toast.show(t("row.copied"), { variant: "success" })
      },
      () => toast.show(t("row.copy_failed"), { variant: "error" }),
    )
  }, [clipboard, haptics, resolved, t, toast])

  const openUrl = useCallback(
    (url: string) => {
      if (!openExternal) return
      void openExternal.open(url)
    },
    [openExternal],
  )

  const chooseOption = useCallback(
    (option: AddressMapsOption) => {
      if (option === "copy") {
        onCopy()
        return
      }
      const url = option === "apple" ? appleUrl : googleUrl
      if (url) openUrl(url)
    },
    [appleUrl, googleUrl, onCopy, openUrl],
  )

  const sheetOptions = useMemo(
    () =>
      addressMapsOptions({
        platform: rowPlatform(),
        hasApple: appleUrl !== null,
        hasGoogle: googleUrl !== null,
        hasCopy: affordances.copy,
      }),
    [appleUrl, googleUrl, affordances.copy],
  )

  const onExternal = useCallback(() => {
    const plan = addressExternalPlan({
      platform: rowPlatform(),
      appleUrl,
      googleUrl,
      hasCopy: affordances.copy,
    })
    if (plan.kind === "direct") {
      openUrl(plan.url)
      return
    }
    if (plan.kind === "sheet") setSheetOpen(true)
  }, [appleUrl, googleUrl, affordances.copy, openUrl])

  const onFocusMap = useCallback(() => {
    if (!point || !focusTarget) return
    haptics.selection()
    const plan = showOnMapPlan(mode)
    const focus = useMapFocus.getState()
    if (focusTarget.kind === "report") {
      focus.setReport(
        { id: focusTarget.id, lat: point.lat, lng: point.lng, category: focusTarget.category },
        plan.owner,
      )
    } else {
      focus.setEvent(
        { id: focusTarget.id, lat: point.lat, lng: point.lng, eventKind: focusTarget.eventKind },
        plan.owner,
      )
    }
    const nav = useNavStore.getState()
    if (plan.switchView) nav.selectView("map")
    else nav.setSnap(1)
  }, [focusTarget, haptics, mode, point])

  if (!display) return null

  const text = (
    <Text style={variant === "compact" ? styles.compactText : styles.text} numberOfLines={numberOfLines}>
      {display}
    </Text>
  )

  if (variant === "compact") {
    return (
      <View style={styles.row}>
        <Icon icon={iconMap.MapPin} size={13} color={th.colors.textSubtle} />
        {text}
        {trailing}
      </View>
    )
  }

  const body = (
    <View style={styles.main} accessibilityLabel={t("row.static_a11y", { address: display })}>
      <Icon icon={iconMap.MapPin} size={14} color={th.colors.textSubtle} />
      {text}
      {trailing}
    </View>
  )

  return (
    <View style={styles.block}>
      <View style={styles.row}>
        {body}
        {affordances.copy ? (
          <AddressIconButton icon="Copy" label={t("row.copy")} onPress={onCopy} />
        ) : null}
        {affordances.externalMaps ? (
          <AddressIconButton icon="Navigation" label={t("row.open_maps")} onPress={onExternal} />
        ) : null}
      </View>
      {affordances.focusMap ? (
        <Pressable
          onPress={onFocusMap}
          accessibilityRole="button"
          {...focusRingProps}
          style={(state) => [
            styles.showMap,
            webTransition,
            webCursorPointer,
            webHover(state) ? styles.showMapHovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.Map} size={14} color={th.colors.accentText} />
          <Text style={[styles.showMapText, webNoSelect]}>{t("row.show_map")}</Text>
        </Pressable>
      ) : null}
      <AddressActionsSheet
        visible={sheetOpen}
        options={sheetOptions}
        onClose={() => setSheetOpen(false)}
        onChoose={chooseOption}
      />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  main: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    borderRadius: t.radius.sm,
    paddingVertical: 2,
  },
  block: {
    gap: t.space["1"],
  },
  showMap: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: t.space["1"],
    marginLeft: 14 + t.space["2"],
    paddingVertical: 2,
    paddingHorizontal: t.space["1"],
    borderRadius: t.radius.pill,
  },
  showMapHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  showMapText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    color: t.colors.accentText,
  },
  text: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  compactText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  iconBtn: {
    width: 28,
    height: 28,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  iconBtnHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  pressed: {
    opacity: 0.7,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimModal,
  },
  sheet: {
    paddingTop: t.space["2"],
    paddingHorizontal: t.space["2"],
    borderTopLeftRadius: t.radius.xl,
    borderTopRightRadius: t.radius.xl,
    backgroundColor: t.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["3"],
    borderRadius: t.radius.md,
  },
  sheetRowHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  sheetLabel: {
    flex: 1,
  },
}))
