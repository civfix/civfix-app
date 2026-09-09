import React, { useCallback, useRef } from "react"
import { Modal, View, Pressable, StyleSheet, Platform, Linking } from "react-native"
import {
  makeThemedStyles,
  useTheme,
  webTransition,
  webHover,
  webCursorPointer,
  focusRingProps,
  webScrimProps,
} from "../theme"
import { Text, Icon, iconMap, type IconName } from "../typography"
import { useT } from "../i18n"
import { useContactsInvite } from "../capabilities"
import { shareLink, absoluteUrl } from "./share"
import { useToast } from "./Toast"

export interface InviteSheetProps {
  visible: boolean
  title: string
  path: string
  onClose: () => void
}

function OptionRow({
  icon,
  color,
  tint,
  label,
  sub,
  a11y,
  onPress,
}: {
  icon: IconName
  color: string
  tint: string
  label: string
  sub: string
  a11y: string
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        webTransition,
        webCursorPointer,
        webHover(state) ? styles.rowHovered : null,
        state.pressed ? styles.rowPressed : null,
      ]}
    >
      <View style={[styles.rowThumb, { backgroundColor: tint }]}>
        <Icon icon={iconMap[icon]} size={18} color={color} />
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textSubtle} />
    </Pressable>
  )
}

export function InviteSheet({ visible, title, path, onClose }: InviteSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("invite")
  const toast = useToast()
  const contactsInvite = useContactsInvite()

  const url = absoluteUrl(path)
  const message = t("message", { title, url })

  const pendingActionRef = useRef<(() => void) | null>(null)
  const runAfterClose = useCallback(
    (action: () => void) => {
      if (Platform.OS === "ios") {
        pendingActionRef.current = action
        onClose()
        return
      }
      onClose()
      action()
    },
    [onClose],
  )
  const onModalDismiss = useCallback(() => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (action) action()
  }, [])

  const onShare = useCallback(() => {
    runAfterClose(() => {
      void shareLink({ title, path, message }).then((result) => {
        if (result === "copied") toast.show(t("toast.copied"), { variant: "success" })
      })
    })
  }, [runAfterClose, title, path, message, toast, t])

  const onCopy = useCallback(() => {
    onClose()
    if (Platform.OS !== "web") return
    const nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined
    if (nav?.clipboard && typeof nav.clipboard.writeText === "function") {
      void nav.clipboard
        .writeText(url)
        .then(() => toast.show(t("toast.copied"), { variant: "success" }))
        .catch(() => {})
    }
  }, [onClose, url, toast, t])

  const onInstagram = useCallback(() => {
    runAfterClose(() => {
      if (!contactsInvite?.copyToClipboard) {
        void shareLink({ title, path, message })
        return
      }
      void contactsInvite
        .copyToClipboard(url)
        .then(() => {
          toast.show(t("toast.copied_instagram"), { variant: "success" })
          return Linking.canOpenURL("instagram://sharesheet").catch(() => false)
        })
        .then((canOpen) => {
          if (canOpen) return Linking.openURL("instagram://sharesheet").then(() => undefined)
          return shareLink({ title, path, message }).then(() => undefined)
        })
        .catch(() => {
          void shareLink({ title, path, message })
        })
    })
  }, [runAfterClose, contactsInvite, url, toast, t, title, path, message])

  const onFacebook = useCallback(() => {
    runAfterClose(() => {
      const sharer = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url)
      void Linking.openURL(sharer).catch(() => {})
    })
  }, [runAfterClose, url])

  const onEmail = useCallback(() => {
    onClose()
    const mailto =
      "mailto:?subject=" +
      encodeURIComponent(t("email_subject", { title })) +
      "&body=" +
      encodeURIComponent(message)
    void Linking.openURL(mailto).catch(() => {})
  }, [onClose, t, title, message])

  const onContacts = useCallback(() => {
    runAfterClose(() => {
      if (!contactsInvite?.available) return
      void contactsInvite.inviteContacts({ message, url }).catch(() => {})
    })
  }, [runAfterClose, contactsInvite, message, url])

  const isWeb = Platform.OS === "web"

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={onModalDismiss}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.dismiss")}
          onPress={onClose}
          {...webScrimProps}
        />
        <View style={styles.center} pointerEvents="box-none">
          <View style={styles.card}>
            <View style={styles.header}>
              <Icon icon={iconMap.UserPlus} size={16} color={th.colors.moss["700"]} />
              <Text variant="bodyStrong" color={th.colors.text} style={styles.headerTitle}>
                {t("title")}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t("a11y.dismiss")}
                hitSlop={8}
                {...focusRingProps}
                style={({ pressed }) => [styles.closeBtn, pressed ? styles.rowPressed : null]}
              >
                <Icon icon={iconMap.Close} size={16} color={th.colors.textSubtle} />
              </Pressable>
            </View>
            <Text variant="caption" color={th.colors.textSubtle}>
              {t("subtitle")}
            </Text>

            <View style={styles.list}>
              <OptionRow
                icon="Share"
                color={th.colors.moss["700"]}
                tint={th.colors.moss["50"]}
                label={t("options.share")}
                sub={t("options.share_sub")}
                a11y={t("a11y.share")}
                onPress={onShare}
              />
              {isWeb ? (
                <OptionRow
                  icon="Copy"
                  color={th.colors.sky["700"]}
                  tint={th.colors.sky["50"]}
                  label={t("options.copy")}
                  sub={t("options.copy_sub")}
                  a11y={t("a11y.copy")}
                  onPress={onCopy}
                />
              ) : null}
              {!isWeb ? (
                <OptionRow
                  icon="Camera"
                  color={th.colors.bloom["700"]}
                  tint={th.colors.bloom["50"]}
                  label={t("options.instagram")}
                  sub={t("options.instagram_sub")}
                  a11y={t("a11y.instagram")}
                  onPress={onInstagram}
                />
              ) : null}
              <OptionRow
                icon="Users"
                color={th.colors.sky["700"]}
                tint={th.colors.sky["50"]}
                label={t("options.facebook")}
                sub={t("options.facebook_sub")}
                a11y={t("a11y.facebook")}
                onPress={onFacebook}
              />
              {isWeb ? (
                <OptionRow
                  icon="Mail"
                  color={th.colors.sun["700"]}
                  tint={th.colors.sun["50"]}
                  label={t("options.email")}
                  sub={t("options.email_sub")}
                  a11y={t("a11y.email")}
                  onPress={onEmail}
                />
              ) : null}
              {!isWeb && contactsInvite?.available ? (
                <OptionRow
                  icon="MessageCircle"
                  color={th.colors.brand.lilac}
                  tint={th.colors.lilac["50"]}
                  label={t("options.contacts")}
                  sub={t("options.contacts_sub")}
                  a11y={t("a11y.contacts")}
                  onPress={onContacts}
                />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimModal,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: t.space["4"],
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "100%",
    gap: t.space["2"],
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
  headerTitle: {
    flex: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    marginTop: t.space["2"],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["3"],
    borderRadius: t.radius.md,
    paddingHorizontal: t.space["2"],
    marginHorizontal: -t.space["2"],
  },
  rowHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowThumb: {
    width: 38,
    height: 38,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMeta: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14,
    color: t.colors.text,
  },
  rowSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
    marginTop: 1,
  },
}))
