import React from "react"
import { View } from "react-native"
import type { TFunction } from "i18next"
import type { PostRefDTO } from "@civfix/shared"
import { Text } from "../../typography"
import { EmbeddedPost } from "../EmbeddedPost"
import { usePostComposerStyles } from "./postComposerStyles"

export function QuotedPreview({
  quotedRef,
  failed,
  t,
  tf,
  timeAgo,
}: {
  quotedRef: PostRefDTO | null
  failed: boolean
  t: TFunction
  tf: TFunction
  timeAgo: (iso: string) => string
}) {
  const styles = usePostComposerStyles()
  return (
    <View style={styles.quoted}>
      {quotedRef ? (
        <EmbeddedPost post={quotedRef} t={tf} timeAgo={timeAgo} />
      ) : failed ? (
        <Text style={styles.quotedUnavailable}>{t("quote.unavailable")}</Text>
      ) : (
        <View style={styles.quotedSkeleton} />
      )}
    </View>
  )
}
