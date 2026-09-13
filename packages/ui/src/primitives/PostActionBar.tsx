import React, { useCallback, useMemo, useRef, useState } from "react"
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  View,
  type StyleProp,
  type View as NativeView,
  type ViewStyle,
} from "react-native"
import type { PostCounts, PostViewer } from "@civfix/shared"
import { tokens } from "@civfix/shared/tokens"
import { Bookmark, Heart, MessageCircle, Repeat2, Share2 } from "lucide-react-native/icons"
import {
  EASE_STANDARD_CSS,
  makeThemedStyles,
  useTheme,
  focusRingProps,
  webCursor,
  webHover,
  webNoSelect,
  webTransition,
  type Theme,
} from "../theme"
import { useReducedMotion } from "../theme/useReducedMotion"
import { Text } from "../typography"
import type { IconName } from "../typography"
import { useT } from "../i18n"
import { useLikePost, useRepost, useSavePost } from "../data/hooks/posts"
import { useAuthState, useRequireAuth } from "../data"
import { useSharePost } from "../share/SharePostContext"
import { PopoverMenu, usePopoverAnchor, type AnchorRect, type PopoverMenuItem } from "./PopoverMenu"
import {
  buildPostActionMenuModel,
  buildPostActionModel,
  buildPostActionMotionModel,
  postActionCountGap,
  postActionGlyphInset,
  postActionHaloFamily,
  postActionHaloInset,
  postActionLayout,
  type PostActionHaloFamily,
  type PostActionKey,
  type PostActionLayout,
  type PostActionModel,
  type PostActionVariant,
} from "./postActionModel"
export {
  buildPostActionMenuModel,
  buildPostActionModel,
  buildPostActionMotionModel,
  formatPostActionCount,
  positionPostActionMenu,
  postActionButtonWidth,
  postActionCountGap,
  postActionGlyphInset,
  postActionHaloFamily,
  postActionHaloInset,
  postActionHaloOverhang,
  postActionLayout,
  postActionRowAvailableWidth,
  postActionRowWidth,
} from "./postActionModel"
export type { PostActionHaloFamily, PostActionLayout, PostActionVariant } from "./postActionModel"

export interface PostActionBarProps {
  postId: string
  counts: PostCounts
  viewer: PostViewer
  authorId?: string | null
  title?: string
  onComment?: () => void
  onQuote?: () => void
  variant?: PostActionVariant
  style?: StyleProp<ViewStyle>
}


const REPOST_MENU_ICONS: Record<"repost" | "quote", IconName> = {
  repost: "Repeat2",
  quote: "MessageCircle",
}

const ACTION_LABEL_KEYS: Record<PostActionKey, string> = {
  like: "post_actions.like",
  repost: "post_actions.repost",
  comment: "post_actions.comment",
  save: "post_actions.save",
  share: "post_actions.share",
}

const TIMELINE_LAYOUT = postActionLayout("timeline")
const CARD_LAYOUT = postActionLayout("card")
const FOCAL_LAYOUT = postActionLayout("focal")
const REPLY_LAYOUT = postActionLayout("reply")

function layoutFor(variant: PostActionVariant): PostActionLayout {
  if (variant === "timeline") return TIMELINE_LAYOUT
  if (variant === "focal") return FOCAL_LAYOUT
  if (variant === "reply") return REPLY_LAYOUT
  return CARD_LAYOUT
}

const TIMELINE_GLYPH_INSET = postActionGlyphInset(TIMELINE_LAYOUT)

function haloTints(
  family: PostActionHaloFamily,
  t: Theme,
): { hover: ViewStyle; press: ViewStyle } {
  switch (family) {
    case "moss":
      return {
        hover: { backgroundColor: t.colors.moss["50"] },
        press: { backgroundColor: t.colors.moss["100"] },
      }
    case "sky":
      return {
        hover: { backgroundColor: t.colors.sky["50"] },
        press: { backgroundColor: t.colors.sky["100"] },
      }
    default:
      return {
        hover: { backgroundColor: t.colors.bloom["50"] },
        press: { backgroundColor: t.colors.bloom["100"] },
      }
  }
}

const HALO_TRANSITION: ViewStyle =
  Platform.OS === "web"
    ? ({
        transitionProperty: "background-color",
        transitionDuration: "120ms",
        transitionTimingFunction: EASE_STANDARD_CSS,
      } as ViewStyle)
    : {}

const RING_FOOTPRINT = Number.parseFloat(/^0 0 0 (\d+(?:\.\d+)?)px/.exec(tokens.shadow.ring)?.[1] ?? "3")
const WEB_ACTION_FOCUS_INSET: ViewStyle =
  Platform.OS === "web" ? ({ outlineOffset: -RING_FOOTPRINT } as unknown as ViewStyle) : {}

interface ActionBoxStyles {
  pad: ViewStyle
  halo: ViewStyle
}

function buildBoxStyles(layout: PostActionLayout): ActionBoxStyles {
  return {
    pad: {
      paddingLeft: postActionGlyphInset(layout),
      gap: postActionCountGap(layout),
    },
    halo: {
      position: "absolute",
      left: postActionHaloInset(layout),
      top: "50%",
      marginTop: -layout.haloSize / 2,
      width: layout.haloSize,
      height: layout.haloSize,
      borderRadius: layout.haloSize / 2,
    },
  }
}

const BOX_STYLES = new Map<PostActionLayout, ActionBoxStyles>([
  [TIMELINE_LAYOUT, buildBoxStyles(TIMELINE_LAYOUT)],
  [CARD_LAYOUT, buildBoxStyles(CARD_LAYOUT)],
  [FOCAL_LAYOUT, buildBoxStyles(FOCAL_LAYOUT)],
  [REPLY_LAYOUT, buildBoxStyles(REPLY_LAYOUT)],
])

const REPLY_MODEL_OPTIONS = { omit: ["save"] as const }

function actionColor(action: PostActionModel, t: Theme): string {
  if (!action.active) return t.colors.textMuted
  if (action.key === "like") return t.colors.brand.bloom
  if (action.key === "repost") return t.colors.moss["700"]
  if (action.key === "save") return t.colors.sky["700"]
  return t.colors.text
}

function ActionGlyph({ action, color, size }: { action: PostActionModel; color: string; size: number }) {
  const common = { size, color, strokeWidth: 2.15 }
  switch (action.key) {
    case "like":
      return <Heart {...common} fill={action.active ? color : "none"} />
    case "repost":
      return <Repeat2 {...common} />
    case "comment":
      return <MessageCircle {...common} />
    case "save":
      return <Bookmark {...common} fill={action.active ? color : "none"} />
    case "share":
      return <Share2 {...common} />
  }
}

const PostActionButton = React.memo(function PostActionButton({
  action,
  label,
  disabled,
  reducedMotion,
  buttonRef,
  layout,
}: {
  action: PostActionModel
  label: string
  disabled: boolean
  reducedMotion: boolean
  buttonRef?: React.Ref<NativeView>
  layout: PostActionLayout
}) {
  const styles = useStyles()
  const t = useTheme()
  const scale = useRef(new Animated.Value(1)).current
  const turn = useRef(new Animated.Value(0)).current
  const useNativeDriver = Platform.OS !== "web"
  const color = actionColor(action, t)
  const rotation = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] })
  const box = useMemo(() => BOX_STYLES.get(layout) ?? buildBoxStyles(layout), [layout])
  const tints = haloTints(postActionHaloFamily(action.key), t)
  const glyphTransform = useMemo(
    () => ({
      transform: [{ scale }, ...(action.key === "repost" ? [{ rotate: rotation }] : [])],
    }),
    [action.key, rotation, scale],
  )
  const countTransform = useMemo(() => ({ transform: [{ scale }] }), [scale])

  const animate = useCallback(() => {
    if (reducedMotion) return
    const motion = buildPostActionMotionModel(false)
    scale.stopAnimation()
    scale.setValue(0.82)
    Animated.timing(scale, {
      toValue: 1,
      duration: motion.duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start()
    if (action.key === "repost") {
      turn.stopAnimation()
      turn.setValue(0)
      Animated.timing(turn, {
        toValue: 1,
        duration: motion.duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }).start(() => turn.setValue(0))
    }
  }, [action.key, reducedMotion, scale, turn, useNativeDriver])

  const onPress = useCallback(() => {
    if (disabled || !action.onPress) return
    animate()
    action.onPress()
  }, [action, animate, disabled])

  return (
    <Pressable
      ref={buttonRef}
      onPress={onPress}
      disabled={disabled || !action.onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={action.countLabel != null ? { text: action.countLabel } : undefined}
      accessibilityState={{ selected: action.active, disabled: disabled || !action.onPress }}
      hitSlop={8}
      {...focusRingProps}
      style={[
        styles.action,
        box.pad,
        layout.target,
        webTransition,
        WEB_ACTION_FOCUS_INSET,
        webCursor(disabled || !action.onPress),
        disabled ? styles.disabled : null,
      ]}
    >
      {(state) => (
        <>
          <View
            style={[
              box.halo,
              HALO_TRANSITION,
              state.pressed ? tints.press : webHover(state) ? tints.hover : null,
            ]}
          />
          <Animated.View style={glyphTransform}>
            <ActionGlyph action={action} color={color} size={layout.glyphSize} />
          </Animated.View>
          {layout.showCounts && action.countLabel != null ? (
            <Animated.View style={[styles.countWrap, countTransform]}>
              <Text
                variant="caption"
                color={color}
                numberOfLines={1}
                style={[styles.count, webNoSelect]}
              >
                {action.countLabel}
              </Text>
            </Animated.View>
          ) : null}
        </>
      )}
    </Pressable>
  )
})

export function PostActionBar({
  postId,
  counts,
  viewer,
  authorId,
  title,
  onComment,
  onQuote,
  variant = "card",
  style,
}: PostActionBarProps) {
  const styles = useStyles()
  const { t } = useT("common")
  const layout = layoutFor(variant)
  const shareTitle = title ?? t("post_actions.default_title")
  const like = useLikePost(postId)
  const repost = useRepost(postId)
  const save = useSavePost(postId)
  const requireAuth = useRequireAuth()
  const viewerId = useAuthState().user?.id
  const isOwnPost = authorId != null && viewerId != null && authorId === viewerId
  const reducedMotion = useReducedMotion()
  const motionDisabled = reducedMotion !== false
  const [repostMenuOpen, setRepostMenuOpen] = useState(false)
  const [repostAnchor, setRepostAnchor] = useState<AnchorRect | null>(null)
  const openRepostMenuAt = useCallback((rect: AnchorRect) => {
    setRepostAnchor(rect)
    setRepostMenuOpen(true)
  }, [])
  const { ref: repostAnchorRef, measure: measureRepostAnchor } = usePopoverAnchor(openRepostMenuAt)
  const closeRepostMenu = useCallback(() => setRepostMenuOpen(false), [])
  const openRepostMenu = useCallback(() => {
    if (measureRepostAnchor()) return
    setRepostAnchor(null)
    setRepostMenuOpen(true)
  }, [measureRepostAnchor])

  const sharePost = useSharePost()
  const onShare = useCallback(
    (path: string) => {
      sharePost.open({ title: shareTitle, path })
    },
    [sharePost, shareTitle],
  )

  const likeMutate = like.mutate
  const repostMutate = repost.mutate
  const saveMutate = save.mutate
  const actions = useMemo(
    () =>
      buildPostActionModel(
        { postId, counts, viewer },
        {
          onLike: (currently) => requireAuth(() => likeMutate(currently), { next: "/" }),
          onRepost: isOwnPost
            ? undefined
            : (currently) =>
                requireAuth(() => {
                  if (!onQuote) {
                    repostMutate(currently)
                    return
                  }
                  openRepostMenu()
                }, { next: "/" }),
          onComment,
          onSave: (currently) => requireAuth(() => saveMutate(currently), { next: "/" }),
          onShare,
        },
        variant === "reply" ? REPLY_MODEL_OPTIONS : undefined,
      ),
    [postId, counts, viewer, isOwnPost, requireAuth, likeMutate, repostMutate, saveMutate, onComment, onQuote, openRepostMenu, onShare, variant],
  )

  const reposted = viewer.reposted
  const toggleRepost = useCallback(() => repostMutate(reposted), [repostMutate, reposted])
  const startQuote = useCallback(() => onQuote?.(), [onQuote])
  const repostMenuItems: PopoverMenuItem[] = useMemo(() => {
    const run: Record<"repost" | "quote", () => void> = { repost: toggleRepost, quote: startQuote }
    return buildPostActionMenuModel(reposted, {
      repost: t("post_actions.repost"),
      undoRepost: t("post_actions.undo_repost"),
      quote: t("post_actions.quote_post"),
    }).map((item) => ({
      key: item.key,
      label: item.label,
      icon: REPOST_MENU_ICONS[item.key],
      onPress: run[item.key],
    }))
  }, [reposted, startQuote, t, toggleRepost])

  const renderButton = (action: (typeof actions)[number]) => (
    <PostActionButton
      key={action.key}
      action={action}
      label={t(ACTION_LABEL_KEYS[action.key])}
      buttonRef={action.key === "repost" ? repostAnchorRef : undefined}
      reducedMotion={motionDisabled}
      layout={layout}
      disabled={
        (action.key === "like" && like.isPending) ||
        (action.key === "repost" && repost.isPending) ||
        (action.key === "save" && save.isPending)
      }
    />
  )
  const byKey = new Map(actions.map((a) => [a.key, a]))
  const leading = layout.keys.flatMap((key) => {
    if (key === layout.trailing) return []
    const action = byKey.get(key)
    return action ? [action] : []
  })
  const trailing = layout.trailing ? byKey.get(layout.trailing) : undefined

  return (
    <View style={style}>
      <View
        style={
          variant === "focal" ? styles.rowFocal
            : variant === "reply" ? styles.rowReply
            : variant === "timeline" ? styles.rowTimeline
            : styles.row
        }
      >
        {leading.map(renderButton)}
        {trailing ? (
          <>
            <View style={styles.spacer} />
            {renderButton(trailing)}
          </>
        ) : null}
      </View>
      <PopoverMenu
        visible={repostMenuOpen}
        anchorRect={repostAnchor}
        items={repostMenuItems}
        accessibilityLabel={t("post_actions.menu_label")}
        returnFocusRef={repostAnchorRef}
        onClose={closeRepostMenu}
      />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    minHeight: CARD_LAYOUT.minHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: CARD_LAYOUT.gap,
  },
  rowFocal: {
    minHeight: FOCAL_LAYOUT.minHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: FOCAL_LAYOUT.gap,
  },
  rowReply: {
    minHeight: REPLY_LAYOUT.minHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: REPLY_LAYOUT.gap,
  },
  rowTimeline: {
    minHeight: TIMELINE_LAYOUT.minHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: TIMELINE_LAYOUT.gap,
    marginLeft: -TIMELINE_GLYPH_INSET,
    marginRight: -TIMELINE_GLYPH_INSET,
  },
  spacer: {
    flex: 1,
  },
  action: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    borderRadius: t.radius.pill,
  },
  disabled: {
    opacity: 0.5,
  },
  countWrap: { flexShrink: 1 },
  count: {
    minWidth: 8,
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: t.fontSize["13"],
  },
}))
