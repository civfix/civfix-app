import React, { useContext, useEffect, useRef } from "react"
import {
  Animated,
  Modal,
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import { tokens } from "@civfix/shared/tokens"
import {
  focusRingProps,
  makeThemedStyles,
  motion,
  useTheme,
  webCursorPointer,
  webHover,
  webScrimProps,
  webTransition,
  type Theme,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import type { IconName } from "../typography"
import { IosKeyboardAvoidingView } from "../shell/IosKeyboardAvoidingView"
import { makeKeyboardAwareScrollHost } from "../shell/KeyboardAwareScroll"
import { PLAIN_SCROLL_HOST, ScrollHostProvider } from "../shell/ScrollHost"
import { useKeyboardReserve } from "../shell/useKeyboardReserve"
import { menuScrimStyle, useMenuMotion, type MenuMotionRecipes } from "./menuMotion"
import { useModalClosed } from "./useModalClosed"

const MODAL_SCROLL_HOST = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST, {
  reserveKeyboardPadding: false,
})

const CARD_RECIPES: MenuMotionRecipes = { enter: motion.sheetMove, exit: motion.sheetDismiss }

export function useDialogWebKeys({
  visible,
  onCommit,
  onClose,
}: {
  visible: boolean
  onCommit?: () => void
  onClose: () => void
}): void {
  const handlersRef = useRef({ onCommit, onClose })
  handlersRef.current = { onCommit, onClose }

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        handlersRef.current.onCommit?.()
      } else if (event.key === "Escape") {
        event.preventDefault()
        handlersRef.current.onClose()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [visible])
}

export interface ModalCardSheetProps {
  visible: boolean
  onClose: () => void
  onCommit?: () => void
  onClosed?: () => void
  headerIcon: IconName
  headerIconColor?: string
  title: string
  dismissLabel: string
  backdropDismissDisabled?: boolean
  error?: string | null
  tone?: "default" | "danger"
  actions: React.ReactNode
  bodyLayout?: "scroll" | "fill"
  bodyContentStyle?: StyleProp<ViewStyle>
  cardStyle?: StyleProp<ViewStyle>
  fullBleed?: boolean
  children: React.ReactNode
}

export function ModalCardSheet({
  visible,
  onClose,
  onCommit,
  onClosed,
  headerIcon,
  headerIconColor,
  title,
  dismissLabel,
  backdropDismissDisabled = false,
  error,
  tone = "default",
  actions,
  bodyLayout = "scroll",
  bodyContentStyle,
  cardStyle,
  fullBleed = false,
  children,
}: ModalCardSheetProps) {
  const styles = useStyles()
  const t = useTheme()
  const insets = useContext(SafeAreaInsetsContext)
  const kbReserve = useKeyboardReserve({ enabled: visible })
  useDialogWebKeys({ visible, onCommit, onClose })
  const cardMotion = useMenuMotion({ visible, recipes: CARD_RECIPES })
  const { rendered } = cardMotion
  const onDismiss = useModalClosed(rendered, onClosed)

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <Animated.View
        style={[styles.root, menuScrimStyle(cardMotion)]}
        pointerEvents={cardMotion.exiting ? "none" : "auto"}
      >
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          accessibilityState={{ disabled: backdropDismissDisabled }}
          onPress={backdropDismissDisabled ? undefined : onClose}
          {...webScrimProps}
        />
        <IosKeyboardAvoidingView
          style={[
            styles.avoider,
            fullBleed ? styles.avoiderFull : null,
            kbReserve > 0 ? { paddingBottom: (fullBleed ? 0 : t.space["4"]) + kbReserve } : null,
          ]}
        >
          <View style={[styles.card, fullBleed ? styles.cardFull : null, cardStyle]}>
            <View
              style={[
                styles.header,
                fullBleed ? styles.headerFull : null,
                fullBleed ? { paddingTop: (insets?.top ?? 0) + t.space["2"] } : null,
              ]}
            >
              {tone === "danger" ? (
                <View style={styles.headerBadge}>
                  <Icon icon={iconMap[headerIcon]} size={16} color={headerIconColor ?? t.colors.brand.bloom} />
                </View>
              ) : (
                <Icon icon={iconMap[headerIcon]} size={16} color={headerIconColor ?? t.colors.text} />
              )}
              <Text variant="bodyStrong" color={t.colors.text} style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {fullBleed ? (
                <Pressable
                  onPress={backdropDismissDisabled ? undefined : onClose}
                  accessibilityRole="button"
                  accessibilityLabel={dismissLabel}
                  accessibilityState={{ disabled: backdropDismissDisabled }}
                  hitSlop={8}
                  {...focusRingProps}
                  style={(state) => [
                    styles.closeBtn,
                    webCursorPointer,
                    webTransition,
                    webHover(state) ? styles.closeBtnHovered : null,
                    state.pressed ? styles.closeBtnPressed : null,
                  ]}
                >
                  <Icon icon={iconMap.Close} size={18} color={t.colors.text} />
                </Pressable>
              ) : null}
            </View>

            {bodyLayout === "fill" ? (
              <View style={[styles.bodyFill, bodyContentStyle]}>
                <ScrollHostProvider value={MODAL_SCROLL_HOST}>{children}</ScrollHostProvider>
              </View>
            ) : (
              <ScrollView
                style={styles.bodyScroll}
                contentContainerStyle={[styles.bodyContent, bodyContentStyle]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            )}

            {error ? (
              <Text
                variant="caption"
                color={tone === "danger" ? t.colors.bloom["700"] : t.colors.bloom["600"]}
                numberOfLines={2}
                style={fullBleed ? styles.errorFull : null}
              >
                {error}
              </Text>
            ) : null}

            {actions ? (
              <View
                style={[
                  styles.actions,
                  fullBleed ? styles.actionsFull : null,
                  fullBleed ? { paddingBottom: (insets?.bottom ?? 0) + t.space["3"] } : null,
                ]}
              >
                {actions}
              </View>
            ) : null}
          </View>
        </IosKeyboardAvoidingView>
      </Animated.View>
    </Modal>
  )
}

export function modalSheetInputFocusedStyle(t: Theme): ViewStyle {
  return Platform.OS === "web"
    ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as ViewStyle)
    : { borderColor: t.colors.accent }
}

export function modalSheetInputStyle(t: Theme) {
  return {
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surfaceTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  } as const
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    flex: 1,
  },
  avoider: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: t.space["4"],
    pointerEvents: "box-none",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimModal,
  },
  bodyScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    gap: t.space["3"],
  },
  bodyFill: {
    flex: 1,
    minHeight: 0,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "100%",
    gap: t.space["3"],
    padding: t.space["4"],
    borderRadius: t.radius.xl,
    backgroundColor: t.colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  headerBadge: {
    width: 32,
    height: 32,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bloom["50"],
  },
  title: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: t.space["2"],
  },
  avoiderFull: {
    padding: 0,
    alignItems: "stretch",
    justifyContent: "flex-start",
  },
  cardFull: {
    flex: 1,
    maxWidth: "100%",
    gap: 0,
    padding: 0,
    borderRadius: 0,
    borderWidth: 0,
  },
  headerFull: {
    paddingHorizontal: t.space["4"],
    paddingBottom: t.space["2"],
    backgroundColor: t.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  closeBtnPressed: {
    opacity: 0.85,
  },
  errorFull: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
  },
  actionsFull: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    backgroundColor: t.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
}))
