import React from "react"
import { StyleSheet, View } from "react-native"
import { FeedNotice, type FeedNoticeProps } from "../FeedNotice"

export type HostStateNoticeProps = Pick<FeedNoticeProps, "icon" | "title" | "body">

export function HostStateNotice({ icon, title, body }: HostStateNoticeProps) {
  return (
    <View style={styles.fill}>
      <FeedNotice plain icon={icon} title={title} body={body} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
})
