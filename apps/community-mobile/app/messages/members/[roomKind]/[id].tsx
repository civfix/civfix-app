import React, { useCallback } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { MembersBody } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import type { RoomKind } from "@civfix/shared"
import { parseRoomKind } from "@/lib/roomKind"
import { RouteHeader } from "@/components/ui/RouteHeader"
import { makeThemedStyles } from "@/theme"

export default function RoomMembersScreen() {
  const router = useRouter()
  const styles = useStyles()
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
      <RouteHeader
        title={t(roomKind === "report" || roomKind === "cleanup" ? "title.chat_info" : "title.members")}
        onBack={onBack}
      />
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

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
}))
