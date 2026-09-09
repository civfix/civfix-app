import React, { useCallback, useEffect, useMemo, useRef } from "react"
import {
  Animated,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type View as RNView,
} from "react-native"
import {
  makeThemedStyles,
  useTheme,
  webCursor,
  webTransition,
  webHover,
  focusRingProps,
  webNoSelect,
  webScrimProps,
} from "../theme"
import { Text, Icon, iconMap, type LucideIcon } from "../typography"
import { useT } from "../i18n"
import { useRequireAuth } from "../data"
import { useNavStore } from "../nav"
import { openReportFlow } from "../bodies/composerCreateFlow"
import { menuCardStyle, menuOrigin, menuScrimStyle, useMenuMotion } from "../primitives/menuMotion"
import { useCreateMenuStore } from "./createMenuStore"
import {
  CREATE_MENU_NOTCH,
  CREATE_MENU_PAD,
  CREATE_MENU_ROW_HEIGHT,
  CREATE_MENU_Z_BELOW_DOCK,
  createMenuCardSize,
  createMenuPlacement,
} from "./createMenuLayout"

interface CreateMenuItem {
  key: string
  icon: LucideIcon
  label: string
  onPress: () => void
}

type Focusable = RNView & { focus?: () => void }

function focusNode(node: RNView | null): void {
  const focusable = node as Focusable | null
  focusable?.focus?.()
}

export function CreateMenu() {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("nav")
  const open = useCreateMenuStore((state) => state.open)
  const anchor = useCreateMenuStore((state) => state.anchor)
  const close = useCreateMenuStore((state) => state.close)
  const requireAuth = useRequireAuth()
  const { width: winW, height: winH } = useWindowDimensions()
  const motion = useMenuMotion({ visible: open })
  const firstItemRef = useRef<RNView | null>(null)
  const returnFocusRef = useRef<RNView | null>(null)

  const items = useMemo<CreateMenuItem[]>(
    () => [
      {
        key: "report",
        icon: iconMap.MapPinPlus,
        label: t("create.report"),
        onPress: openReportFlow,
      },
      {
        key: "event",
        icon: iconMap.Calendar,
        label: t("create.event"),
        onPress: () =>
          requireAuth(() => useNavStore.getState().push({ kind: "create-cleanup" }), {
            next: "/host",
          }),
      },
      {
        key: "post",
        icon: iconMap.SquarePen,
        label: t("create.post"),
        onPress: () =>
          requireAuth(() => useNavStore.getState().push({ kind: "composer" }), { next: "/compose" }),
      },
    ],
    [requireAuth, t],
  )

  const handlePress = useCallback(
    (item: CreateMenuItem) => {
      close()
      item.onPress()
    },
    [close],
  )

  useEffect(() => {
    if (!open) return
    return useNavStore.subscribe((state, previous) => {
      if (
        state.view === previous.view &&
        state.stack === previous.stack &&
        state.active === previous.active
      )
        return
      close()
    })
  }, [open, close])

  useEffect(() => {
    if (!open || Platform.OS !== "android") return
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      close()
      return true
    })
    return () => subscription.remove()
  }, [open, close])

  const viewport = `${winW}x${winH}`
  const lastViewport = useRef(viewport)
  useEffect(() => {
    if (lastViewport.current === viewport) return
    lastViewport.current = viewport
    close()
  }, [viewport, close])

  useEffect(() => {
    if (!open || !motion.rendered || Platform.OS !== "web" || typeof document === "undefined") return
    returnFocusRef.current = document.activeElement as unknown as RNView | null
    focusNode(firstItemRef.current)
    return () => {
      const target = returnFocusRef.current
      returnFocusRef.current = null
      focusNode(target)
    }
  }, [open, motion.rendered])

  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof document === "undefined") return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      close()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, close])

  if (!motion.rendered) return null

  const card = createMenuCardSize(items.length)
  const placement = anchor
    ? createMenuPlacement(anchor, { width: winW, height: winH }, card)
    : null
  const origin = menuOrigin(
    anchor,
    placement ? { left: placement.left, top: placement.top, ...card } : null,
  )

  return (
    <View
      style={styles.root}
      pointerEvents={motion.exiting ? "none" : "auto"}
      accessibilityViewIsModal
      aria-modal={true}
    >
      <Animated.View
        style={[styles.backdrop, menuScrimStyle(motion)]}
        pointerEvents="none"
      />
      <Pressable
        style={styles.backdropTouch}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.dismiss_create_menu")}
        onPress={close}
        {...webScrimProps}
      />
      <Animated.View
        style={[
          styles.bubble,
          { width: card.width },
          placement
            ? { position: "absolute", left: placement.left, top: placement.top }
            : styles.bubbleCentered,
          menuCardStyle(motion, origin),
        ]}
      >
        {placement ? (
          <View
            style={[
              styles.notch,
              { left: placement.notchLeft },
              placement.side === "above" ? styles.notchBelowCard : styles.notchAboveCard,
            ]}
            pointerEvents="none"
          />
        ) : null}
        <View style={styles.card} accessibilityRole="menu" accessibilityLabel={t("a11y.create_menu")}>
          {items.map((item, index) => (
            <Pressable
              key={item.key}
              ref={index === 0 ? firstItemRef : null}
              onPress={() => handlePress(item)}
              accessibilityRole="menuitem"
              accessibilityLabel={item.label}
              {...focusRingProps}
              style={(state) => [
                styles.row,
                webTransition,
                webCursor(false),
                webHover(state) ? styles.rowHovered : null,
                state.pressed ? styles.rowPressed : null,
              ]}
            >
              <Icon icon={item.icon} size={20} color={th.colors.text} />
              <Text
                variant="body"
                color={th.colors.text}
                numberOfLines={1}
                style={[styles.rowLabel, webNoSelect]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: CREATE_MENU_Z_BELOW_DOCK,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimModal,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  bubble: {
    alignSelf: "center",
  },
  bubbleCentered: {
    marginTop: "auto",
    marginBottom: "auto",
  },
  card: {
    paddingVertical: CREATE_MENU_PAD,
    paddingHorizontal: CREATE_MENU_PAD,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
  notch: {
    position: "absolute",
    width: CREATE_MENU_NOTCH,
    height: CREATE_MENU_NOTCH,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    borderRadius: t.radius.xs,
    transform: [{ rotate: "45deg" }],
  },
  notchBelowCard: {
    bottom: -CREATE_MENU_NOTCH / 2,
  },
  notchAboveCard: {
    top: -CREATE_MENU_NOTCH / 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    height: CREATE_MENU_ROW_HEIGHT - 2,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.md,
  },
  rowHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  rowPressed: {
    backgroundColor: t.colors.surfaceTint,
    opacity: 0.85,
  },
  rowLabel: {
    flex: 1,
  },
}))
