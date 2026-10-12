import React, { useCallback } from "react"
import { View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated"
import { Text } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { fontFamily, makeThemedStyles, useTheme } from "@/theme"
import { SIGN_SAG, hangSign, leftChain, stepSign, type SignSize, type SignSwing } from "@/lib/notFoundSign"
import { useStageLoop } from "./useStageLoop"

// The phone geometry of community-web's not-found.css.
const SIGN: SignSize = { width: 230, height: 116, boltInset: 22, chain: 38 }
const BAR_TOP = 14
const BAR_HEIGHT = 10
const BAR_OVERHANG = 28
const LINK = 6
const LINK_GAP = 3
const RING_INSET = 6
const RING = 3
const STREET_TRACKING = 0.16
const LINKS = Math.ceil(leftChain(SIGN, SIGN_SAG).length / (LINK + LINK_GAP)) + 1

/**
 * The sign is laid out hanging level; only its tilt about the right bolt and
 * the stretched left chain move. Reduced motion shows the crooked rest pose
 * straight away, so the still keeps the joke.
 */
export function SignStage({ live }: { live: boolean }) {
  const { t } = useT("not-found")
  const styles = useStyles()
  const theme = useTheme()
  const swing = useSharedValue<SignSwing>(live ? hangSign() : { ...hangSign(), angle: SIGN_SAG })

  const step = useCallback(
    (dt: number) => {
      "worklet"
      let moving = true
      swing.modify(<T extends SignSwing>(s: T): T => {
        moving = stepSign(s, SIGN, dt)
        return s
      })
      return moving
    },
    [swing],
  )
  useStageLoop(live ? step : null)

  const signPose = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value.angle}rad` }] }))
  const chainPose = useAnimatedStyle(() => {
    const chain = leftChain(SIGN, swing.value.angle)
    return { height: chain.length, transform: [{ rotate: `${chain.angle}rad` }] }
  })

  return (
    <View style={styles.scene} pointerEvents="none">
      <View style={styles.rig}>
        <View style={styles.bar} />
        <Animated.View style={[styles.chain, styles.chainLeft, chainPose]}>
          <Links />
        </Animated.View>
        <View style={[styles.chain, styles.chainRight]}>
          <Links />
        </View>
        <Animated.View style={[styles.sign, theme.shadows.s3, signPose]}>
          <View style={styles.ring} />
          <View style={[styles.bolt, styles.boltLeft]} />
          <View style={[styles.bolt, styles.boltRight]} />
          <Text style={styles.number} color={theme.colors.onAccent}>
            404
          </Text>
          <Text style={styles.street} color={theme.colors.onAccent}>
            {t("sign_street")}
          </Text>
        </Animated.View>
      </View>
    </View>
  )
}

function Links() {
  const styles = useStyles()
  return (
    <>
      {Array.from({ length: LINKS }, (_, i) => (
        <View key={i} style={styles.link} />
      ))}
    </>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scene: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  rig: {
    position: "absolute",
    top: BAR_TOP,
    left: "50%",
    marginLeft: -SIGN.width / 2,
    width: SIGN.width,
    height: SIGN.chain + SIGN.height,
  },
  bar: {
    position: "absolute",
    top: -BAR_HEIGHT / 2,
    left: -BAR_OVERHANG,
    right: -BAR_OVERHANG,
    height: BAR_HEIGHT,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.neutral.ink3,
  },
  chain: {
    position: "absolute",
    top: 0,
    width: t.space["1"],
    height: SIGN.chain,
    gap: LINK_GAP,
    borderRadius: t.radius.pill,
    overflow: "hidden",
    transformOrigin: "50% 0%",
  },
  chainLeft: {
    left: SIGN.boltInset - t.space["1"] / 2,
  },
  chainRight: {
    left: SIGN.width - SIGN.boltInset - t.space["1"] / 2,
  },
  link: {
    height: LINK,
    backgroundColor: t.colors.neutral.ink3,
  },
  sign: {
    position: "absolute",
    top: SIGN.chain,
    left: 0,
    width: SIGN.width,
    height: SIGN.height,
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["1"],
    borderRadius: t.radius.md,
    backgroundColor: t.colors.moss["700"],
    transformOrigin: [SIGN.width - SIGN.boltInset, 0, 0],
  },
  ring: {
    position: "absolute",
    top: RING_INSET,
    left: RING_INSET,
    right: RING_INSET,
    bottom: RING_INSET,
    borderWidth: RING,
    borderRadius: t.radius.md - RING_INSET,
    borderColor: t.colors.onAccent,
  },
  bolt: {
    position: "absolute",
    top: t.space["4"],
    width: t.space["2"],
    height: t.space["2"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.onAccent,
  },
  boltLeft: {
    left: SIGN.boltInset - t.space["2"] / 2,
  },
  boltRight: {
    right: SIGN.boltInset - t.space["2"] / 2,
  },
  number: {
    fontFamily: fontFamily.brand,
    fontSize: SIGN.height * 0.56,
    lineHeight: SIGN.height * 0.56,
    // As on web: the display face leaves empty space above its digits; pulling the number up
    // centres the number and name together on the plate.
    marginTop: -SIGN.height * 0.05,
    includeFontPadding: false,
  },
  street: {
    fontFamily: fontFamily.bodyBold,
    fontSize: t.fontSize["12"],
    letterSpacing: t.fontSize["12"] * STREET_TRACKING,
    // Tracking trails the last letter too; matching it on the left keeps the name centred.
    paddingLeft: t.fontSize["12"] * STREET_TRACKING,
    textTransform: "uppercase",
  },
}))
