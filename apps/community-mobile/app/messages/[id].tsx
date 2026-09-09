import React, { useMemo } from "react"
import { View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ConversationBody } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import type { PersonDTO, RoomKind } from "@civfix/shared"
import { parseRoomKind } from "@/lib/roomKind"
import { useTheme } from "@/theme"

export default function ConversationScreen() {
  const router = useRouter()
  const th = useTheme()
  const { t } = useT("conversation")
  const { id, roomKind: roomKindParam, peerId, peerName, peerHandle } = useLocalSearchParams<{
    id: string
    roomKind?: string
    peerId?: string
    peerName?: string
    peerHandle?: string
  }>()

  const roomKind: RoomKind = parseRoomKind(roomKindParam)

  const peer = useMemo<PersonDTO | undefined>(() => {
    if (roomKind !== "dm" || !peerId) return undefined
    return {
      id: peerId,
      name: peerName || (peerHandle ? `@${peerHandle}` : t("header.direct_message")),
      handle: peerHandle || null,
      bio: null,
      avatar: null,
      avatarUrl: null,
      followers: 0,
      following: 0,
      isFollowing: false,
    } as PersonDTO
  }, [roomKind, peerId, peerName, peerHandle, t])

  return (
    <View style={{ flex: 1, backgroundColor: th.colors.bg }}>
      <ConversationBody
        id={id}
        roomKind={roomKind}
        {...(peer ? { peer } : {})}
        fullScreen
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        onOpenProfile={(personId) => router.push({ pathname: "/people/[id]", params: { id: personId } })}
        onOpenMembers={() =>
          router.push({
            pathname: "/messages/members/[roomKind]/[id]",
            params: { roomKind, id },
          })
        }
        onOpenGroupInfo={() => router.push({ pathname: "/groups/[id]/info", params: { id } })}
        onViewReport={() => router.push({ pathname: "/pin/[id]", params: { id } })}
      />
    </View>
  )
}
