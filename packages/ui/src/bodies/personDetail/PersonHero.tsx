import React from "react"
import { View } from "react-native"
import { resolveAvatarGradient, type UserProfileDTO } from "@civfix/shared"
import { Text } from "../../typography"
import { Avatar, DonateBlock, SocialLinksRow, VerifiedBadge } from "../../primitives"
import { AffiliationRow } from "../AffiliationRow"
import { ProfileStatsRow, type ProfileConnectionKey } from "../ProfileStatsRow"
import { usePersonDetailStyles } from "./personDetailStyles"

export function PersonHero({
  profile,
  onOpenConnections,
}: {
  profile: UserProfileDTO
  onOpenConnections: (which: ProfileConnectionKey) => void
}) {
  const styles = usePersonDetailStyles()
  return (
    <>
      <View style={styles.hero}>
        <Avatar
          name={profile.name}
          seed={profile.id}
          photoUrl={profile.avatarUrl}
          gradient={resolveAvatarGradient(profile.avatar, profile.id)}
          size={72}
        />
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}
          </Text>
          {profile.official ? <VerifiedBadge size="md" /> : null}
        </View>
        {profile.handle ? (
          <View style={styles.handleRow}>
            <Text style={styles.handle} numberOfLines={1}>
              @{profile.handle}
            </Text>
          </View>
        ) : null}
        {profile.bio ? (
          <Text style={styles.bio} numberOfLines={4}>
            {profile.bio}
          </Text>
        ) : null}
      </View>

      {profile.organization ? (
        <AffiliationRow organization={profile.organization} style={styles.affiliation} />
      ) : null}

      <SocialLinksRow links={profile.socialLinks} style={styles.socialRow} />

      <ProfileStatsRow
        followers={profile.followers}
        following={profile.following}
        stats={profile.stats}
        onOpenConnections={onOpenConnections}
      />

      <View style={styles.donate}>
        <DonateBlock url={profile.donationUrl} ownerName={profile.name} />
      </View>
    </>
  )
}
