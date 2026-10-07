import React from "react"
import { View } from "react-native"
import { radius } from "../../theme"
import { SkeletonBlock, SkeletonGroup, SkeletonList, SkeletonText } from "../../primitives"
import { usePersonDetailStyles } from "./personDetailStyles"

export function PersonDetailSkeleton() {
  const styles = usePersonDetailStyles()
  return (
    <SkeletonGroup>
      <View style={styles.hero}>
        <SkeletonBlock width={72} height={72} radius={36} />
        <SkeletonText width={168} height={18} style={styles.skeletonName} />
        <SkeletonText width={104} height={12} style={styles.skeletonHandle} />
        <SkeletonText width={248} height={12} style={styles.skeletonBio} />
        <SkeletonText width={196} height={12} style={styles.skeletonBioLast} />
      </View>
      <View style={styles.skeletonStats}>
        <SkeletonBlock width="30%" height={44} radius={radius.md} />
        <SkeletonBlock width="30%" height={44} radius={radius.md} />
        <SkeletonBlock width="30%" height={44} radius={radius.md} />
      </View>
      <View style={styles.actions}>
        <SkeletonBlock width="100%" height={40} radius={radius.pill} style={styles.followAction} />
        <SkeletonBlock width={40} height={40} radius={20} />
      </View>
      <View style={styles.skeletonTabs}>
        <SkeletonBlock width={72} height={30} radius={radius.pill} />
        <SkeletonBlock width={72} height={30} radius={radius.pill} />
        <SkeletonBlock width={72} height={30} radius={radius.pill} />
      </View>
      <SkeletonList rows={3} kind="text" />
    </SkeletonGroup>
  )
}
