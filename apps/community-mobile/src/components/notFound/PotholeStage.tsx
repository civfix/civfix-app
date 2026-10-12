import React, { useCallback } from "react"
import { View, useWindowDimensions } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated"
import Svg, { ClipPath, Defs, Ellipse } from "react-native-svg"
import { Text } from "@civfix/ui"
import { fontFamily, makeThemedStyles, useTheme } from "@/theme"
import {
  dropPothole,
  restingPothole,
  stepPothole,
  type PotholePieceName,
  type PotholeScene,
} from "@/lib/notFoundPothole"
import { useStageLoop } from "./useStageLoop"

// The phone geometry of community-web's not-found.css.
const STAGE_HEIGHT = 240
const GLYPH = 116
const LINE = GLYPH * 0.78
const ROAD = 64
const LANE = 5
const LANE_DASH = 36
const LANE_GAP = 28
const HOLE_WIDTH = GLYPH * 0.92
const HOLE_HEIGHT = 40
const HOLE_DROP = 22
const HOLE_RIM = 8
/** The 0 sits this far below the hole's rim line, so its foot is hidden in the hole. */
const SUNK = GLYPH * 0.14
/** Where the web's 0.78em line box seats the digits' baseline: this far above its bottom edge. */
const BASELINE = GLYPH * 0.108
const DROP = STAGE_HEIGHT + 40

export function PotholeStage({ live }: { live: boolean }) {
  const styles = useStyles()
  const theme = useTheme()
  const { width } = useWindowDimensions()
  const scene = useSharedValue<PotholeScene>(live ? dropPothole(DROP) : restingPothole())

  const step = useCallback(
    (dt: number) => {
      "worklet"
      let moving = true
      scene.modify(<T extends PotholeScene>(s: T): T => {
        moving = stepPothole(s, dt)
        return s
      })
      return moving
    },
    [scene],
  )
  useStageLoop(live ? step : null)

  const dark = theme.scheme === "dark"
  // As on web: in dark the hole is the page's own colour, with no lit rim.
  const holeFill = dark ? theme.colors.neutral.paper : theme.colors.neutral.ink3
  const holeRim = dark ? theme.colors.bg : theme.colors.neutral.ink2

  return (
    <View style={styles.scene} pointerEvents="none">
      <View style={styles.road}>
        <View style={styles.lane}>
          {Array.from({ length: Math.ceil(width / (LANE_DASH + LANE_GAP)) }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
      </View>
      <View style={styles.row}>
        <Glyph scene={scene} name="firstFour" char="4" />
        <View style={styles.holeSlot}>
          <Svg width={HOLE_WIDTH} height={HOLE_HEIGHT} style={styles.hole}>
            <Defs>
              <ClipPath id="nf-hole">
                <Ellipse cx={HOLE_WIDTH / 2} cy={HOLE_HEIGHT / 2} rx={HOLE_WIDTH / 2} ry={HOLE_HEIGHT / 2} />
              </ClipPath>
            </Defs>
            <Ellipse cx={HOLE_WIDTH / 2} cy={HOLE_HEIGHT / 2} rx={HOLE_WIDTH / 2} ry={HOLE_HEIGHT / 2} fill={holeRim} />
            <Ellipse
              cx={HOLE_WIDTH / 2}
              cy={HOLE_HEIGHT / 2 + HOLE_RIM}
              rx={HOLE_WIDTH / 2}
              ry={HOLE_HEIGHT / 2}
              fill={holeFill}
              clipPath="url(#nf-hole)"
            />
          </Svg>
          {/* Clips only below the hole's rim line: the 0 sinks in, and still falls in from above. */}
          <View style={styles.holeClip}>
            <Glyph scene={scene} name="zero" char="0" />
          </View>
        </View>
        <Glyph scene={scene} name="lastFour" char="4" />
      </View>
    </View>
  )
}

function Glyph({ scene, name, char }: { scene: SharedValue<PotholeScene>; name: PotholePieceName; char: string }) {
  const styles = useStyles()
  const theme = useTheme()
  const zero = name === "zero"
  const pose = useAnimatedStyle(() => {
    const piece = scene.value.pieces[name]
    return {
      transform: [
        { translateY: piece.dy },
        { rotate: `${piece.angle}deg` },
        { scaleX: 1 + piece.squash },
        { scaleY: 1 - piece.squash },
      ],
    }
  })
  return (
    <Animated.View style={[styles.glyph, zero ? styles.sunk : null, pose]}>
      <Text style={styles.glyphText} color={zero ? theme.colors.brand.bloom : theme.colors.text}>
        {char}
      </Text>
    </Animated.View>
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
  road: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: ROAD,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.neutral.ink5,
    overflow: "hidden",
  },
  lane: {
    position: "absolute",
    left: t.space["4"],
    right: t.space["4"],
    bottom: t.space["3"],
    height: LANE,
    flexDirection: "row",
    gap: LANE_GAP,
    borderRadius: t.radius.pill,
    overflow: "hidden",
  },
  dash: {
    width: LANE_DASH,
    height: LANE,
    backgroundColor: t.colors.sun["300"],
  },
  row: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: t.space["10"],
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: t.space["4"],
  },
  glyph: {
    height: LINE,
    alignItems: "center",
    justifyContent: "flex-end",
    transformOrigin: "50% 100%",
  },
  sunk: {
    top: SUNK,
  },
  glyphText: {
    fontFamily: fontFamily.brand,
    fontSize: GLYPH,
    lineHeight: GLYPH,
    transform: [{ translateY: -BASELINE }],
    includeFontPadding: false,
  },
  holeSlot: {
    width: LINE,
    height: LINE,
    alignItems: "center",
  },
  hole: {
    position: "absolute",
    left: (LINE - HOLE_WIDTH) / 2,
    bottom: -HOLE_DROP,
  },
  holeClip: {
    position: "absolute",
    left: -GLYPH / 2,
    right: -GLYPH / 2,
    bottom: 0,
    top: -(DROP + GLYPH),
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
}))
