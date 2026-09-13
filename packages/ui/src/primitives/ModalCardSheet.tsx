import React, { useEffect, useRef } from "react"
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { tokens } from "@civfix/shared/tokens"
import { makeThemedStyles, useTheme, webScrimProps, type Theme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import type { IconName } from "../typography"
import { IosKeyboardAvoidingView } from "../shell/IosKeyboardAvoidingView"
import { makeKeyboardAwareScrollHost } from "../shell/KeyboardAwareScroll"
import { PLAIN_SCROLL_HOST, ScrollHostProvider } from "../shell/ScrollHost"
import { useKeyboardReserve } from "../shell/useKeyboardReserve"

const MODAL_SCROLL_HOST = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST, {
  reserveKeyboardPadding: false,
})

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
  onDismiss?: () => void
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
  children: React.ReactNode
}

export function ModalCardSheet({
  visible,
  onClose,
  onCommit,
  onDismiss,
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
  children,
}: ModalCardSheetProps) {
  const styles = useStyles()
  const t = useTheme()
  const kbReserve = useKeyboardReserve({ enabled: visible })
  useDialogWebKeys({ visible, onCommit, onClose })

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          accessibilityState={{ disabled: backdropDismissDisabled }}
          onPress={backdropDismissDisabled ? undefined : onClose}
          {...webScrimProps}
        />
        <IosKeyboardAvoidingView
          style={[styles.avoider, kbReserve > 0 ? { paddingBottom: t.space["4"] + kbReserve } : null]}
        >
          <View style={[styles.card, cardStyle]}>
            <View style={styles.header}>
              {tone === "danger" ? (
                <View style={styles.headerBadge}>
                  <Icon icon={iconMap[headerIcon]} size={16} color={headerIconColor ?? t.colors.brand.bloom} />
                </View>
              ) : (
                <Icon icon={iconMap[headerIcon]} size={16} color={headerIconColor ?? t.colors.text} />
              )}
              <Text variant="bodyStrong" color={t.colors.text} style={styles.title}>
                {title}
              </Text>
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
              >
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>{actions}</View>
          </View>
        </IosKeyboardAvoidingView>
      </View>
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
}))
