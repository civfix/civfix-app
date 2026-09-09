import React, { useCallback } from "react"
import { StyleSheet, View, Pressable } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { MembersBody, Icon, Text, iconMap } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import type { RoomKind } from "@civfix/shared"
import { parseRoomKind } from "@/lib/roomKind"
import { makeThemedStyles, useTheme } from "@/theme"

export default function RoomMembersScreen() {
  const router = useRouter()
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("nav")
  const insets = useSafeAreaInsets()
  const { id, roomKind: roomKindParam } = useLocalSearchParams<{ id: string; roomKind?: string }>()
  const roomKind: RoomKind = parseRoomKind(roomKindParam)

  const onBack = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace("/")),
    [router],
  )

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
        >
          <Icon icon={iconMap.ArrowLeft} size={BACK_ICON_SIZE} color={th.colors.text} />
        </Pressable>
        <View pointerEvents="none" style={styles.titleWrap}>
          <Text style={styles.title}>
            {t(roomKind === "report" || roomKind === "cleanup" ? "title.chat_info" : "title.members")}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>
      <MembersBody
        id={id}
        roomKind={roomKind}
        onOpenPerson={(navId) => router.push({ pathname: "/people/[id]", params: { id: navId } })}
        onOpenReport={() => router.push({ pathname: "/pin/[id]", params: { id } })}
        onOpenEvent={() => router.push({ pathname: "/cleanups/[id]", params: { id } })}
        onLeft={onBack}
      />
    </View>
  )
}

const BACK_ICON_SIZE = 20

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    minHeight: 60,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
    position: "relative",
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  titleWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  title: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 17,
    lineHeight: 22,
    color: t.colors.text,
  },
  headerSpacer: { flex: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.94 }] },
}))
