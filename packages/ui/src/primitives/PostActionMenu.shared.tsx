import React from "react"
import {
  Animated,
  Pressable,
  StyleSheet,
  type PressableStateCallbackType,
  type StyleProp,
  type View as NativeView,
  type ViewStyle,
} from "react-native"
import { MessageCircle, Repeat2 } from "lucide-react-native/icons"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text } from "../typography"
import { menuCardStyle, menuOrigin, useMenuMotion, type MenuMotion } from "./menuMotion"
import { positionPostActionMenu, type PostActionMenuRect } from "./postActionModel"

export const MENU_SIZE = { width: 190, height: 104 }

export function usePostActionMenuMotion({
  visible,
  reducedMotion,
  useNativeDriver,
}: {
  visible: boolean
  reducedMotion: boolean
  useNativeDriver: boolean
}): MenuMotion {
  return useMenuMotion({ visible, reducedMotion, useNativeDriver })
}

export function resolvePostActionMenuOrigin(
  anchorRect: PostActionMenuRect | null,
  position: { left: number; top: number },
) {
  return menuOrigin(anchorRect, { ...position, ...MENU_SIZE })
}

export function resolvePostActionMenuPosition(
  anchorRect: PostActionMenuRect | null,
  viewport: { width: number; height: number },
): { left: number; top: number } {
  if (anchorRect) return positionPostActionMenu(anchorRect, viewport, MENU_SIZE)
  return {
    left: Math.max(8, (viewport.width - MENU_SIZE.width) / 2),
    top: Math.max(8, (viewport.height - MENU_SIZE.height) / 2),
  }
}

export interface PostActionMenuCardProps {
  motion: MenuMotion
  origin: ReturnType<typeof menuOrigin>
  position: { left: number; top: number }
  menuLabel: string
  items: readonly [{ key: "repost"; label: string }, { key: "quote"; label: string }]
  firstItemRef?: React.Ref<NativeView>
  lastItemRef?: React.Ref<NativeView>
  itemFeedback: (state: PressableStateCallbackType) => StyleProp<ViewStyle>
  onRepost: () => void
  onQuote: () => void
}

export function PostActionMenuCard({
  motion,
  origin,
  position,
  menuLabel,
  items,
  firstItemRef,
  lastItemRef,
  itemFeedback,
  onRepost,
  onQuote,
}: PostActionMenuCardProps) {
  const styles = usePostActionMenuStyles()
  const t = useTheme()
  return (
    <Animated.View
      accessibilityRole="menu"
      accessibilityLabel={menuLabel}
      style={[styles.menu, position, menuCardStyle(motion, origin)]}
    >
      <Pressable
        ref={firstItemRef}
        accessibilityRole="menuitem"
        accessibilityLabel={items[0].label}
        onPress={onRepost}
        {...focusRingProps}
        style={(state) => [styles.item, itemFeedback(state)]}
      >
        <Repeat2 size={17} color={t.colors.text} />
        <Text variant="bodyStrong">{items[0].label}</Text>
      </Pressable>
      <Pressable
        ref={lastItemRef}
        accessibilityRole="menuitem"
        accessibilityLabel={items[1].label}
        onPress={onQuote}
        {...focusRingProps}
        style={(state) => [styles.item, itemFeedback(state)]}
      >
        <MessageCircle size={17} color={t.colors.text} />
        <Text variant="bodyStrong">{items[1].label}</Text>
      </Pressable>
    </Animated.View>
  )
}

export const usePostActionMenuStyles = makeThemedStyles((t) => ({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
  menu: {
    position: "absolute",
    width: MENU_SIZE.width,
    minHeight: MENU_SIZE.height,
    padding: t.space["1"],
    borderRadius: 18,
    backgroundColor: t.colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s2,
  },
  item: {
    minHeight: 48,
    paddingHorizontal: t.space["3"],
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    borderRadius: t.radius.md,
  },
  itemHovered: { backgroundColor: t.colors.surfaceTint },
  itemPressed: { opacity: 0.78, backgroundColor: t.colors.surfaceTint },
}))
