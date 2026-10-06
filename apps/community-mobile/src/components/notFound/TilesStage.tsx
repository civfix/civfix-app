import React, { useCallback, useMemo } from "react"
import { View, type LayoutChangeEvent } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated"
import { Text } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { fontFamily, makeThemedStyles, shadowSchemes, useTheme, type Theme } from "@/theme"
import {
  dragTile,
  dropTiles,
  grabTile,
  releaseTile,
  stepTiles,
  tileAt,
  type TileBody,
  type TileBox,
} from "@/lib/notFoundTiles"
import { useStageLoop } from "./useStageLoop"

// The phone geometry of community-web's not-found.css.
const TILE = 92
const GROUND = 6

const DIGITS = ["4", "0", "4"] as const

function tileColor(i: number, t: Theme): string {
  return [t.colors.brand.bloom, t.colors.sky["600"], t.colors.brand.moss][i] ?? t.colors.brand.bloom
}

export function TilesStage({ live }: { live: boolean }) {
  const { t } = useT("not-found")
  const styles = useStyles()
  const theme = useTheme()
  const bodies = useSharedValue<TileBody[]>([])
  const box = useSharedValue<TileBox | null>(null)
  const grabbed = useSharedValue(-1)

  const step = useCallback(
    (dt: number) => {
      "worklet"
      const size = box.value
      if (!size) return true
      if (bodies.value.length === 0) bodies.value = dropTiles(size)
      let moving = true
      bodies.modify(<T extends TileBody[]>(list: T): T => {
        moving = stepTiles(list, size, dt)
        return list
      })
      return moving
    },
    [bodies, box],
  )
  // The loop stops once the row rests, so a phone left on this screen (or with
  // the app in the background) draws nothing; a grab or a new stage size wakes it.
  const wake = useStageLoop(live ? step : null)

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout
      box.value = { width, height, tile: TILE }
      wake()
    },
    [box, wake],
  )

  const throwing = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((event, manager) => {
          if (grabbed.value >= 0) return
          const touch = event.allTouches[0]
          const hit = touch ? tileAt(bodies.value, TILE, touch.x, touch.y) : -1
          if (!touch || hit < 0) {
            // Not on a tile: the screen scrolls as usual.
            manager.fail()
            return
          }
          grabbed.value = hit
          bodies.modify(<T extends TileBody[]>(list: T): T => {
            if (list[hit]) grabTile(list[hit], touch.x, touch.y)
            return list
          })
          wake()
          manager.activate()
        })
        .onUpdate((event) => {
          const i = grabbed.value
          if (i < 0) return
          bodies.modify(<T extends TileBody[]>(list: T): T => {
            if (list[i]) dragTile(list[i], event.x, event.y, event.velocityX, event.velocityY)
            return list
          })
        })
        .onFinalize(() => {
          const i = grabbed.value
          if (i < 0) return
          grabbed.value = -1
          bodies.modify(<T extends TileBody[]>(list: T): T => {
            if (list[i]) releaseTile(list[i])
            return list
          })
        }),
    [bodies, grabbed, wake],
  )

  return (
    <>
      {live ? (
        <GestureDetector gesture={throwing}>
          <View style={styles.tiles} onLayout={onLayout}>
            {DIGITS.map((digit, i) => (
              <LiveTile key={i} index={i} digit={digit} bodies={bodies} />
            ))}
          </View>
        </GestureDetector>
      ) : (
        <View style={[styles.tiles, styles.row]}>
          {DIGITS.map((digit, i) => (
            <Tile key={i} index={i} digit={digit} />
          ))}
        </View>
      )}
      <View style={styles.ground} />
      {live ? (
        <Text style={styles.hint} color={theme.colors.textSubtle}>
          {t("tiles_hint")}
        </Text>
      ) : null}
    </>
  )
}

function Tile({ index, digit }: { index: number; digit: string }) {
  const styles = useStyles()
  const theme = useTheme()
  return (
    <View
      style={[
        styles.tile,
        theme.shadows.s3,
        { backgroundColor: tileColor(index, theme), boxShadow: shadowSchemes[theme.scheme].sheenTop },
      ]}
    >
      <Text style={styles.digit} color={theme.colors.onAccent}>
        {digit}
      </Text>
    </View>
  )
}

function LiveTile({ index, digit, bodies }: { index: number; digit: string; bodies: SharedValue<TileBody[]> }) {
  const placed = useAnimatedStyle(() => {
    const b = bodies.value[index]
    // Hidden until the first step has dropped the tiles above the stage.
    if (!b) return { opacity: 0 }
    return {
      opacity: 1,
      transform: [{ translateX: b.x - TILE / 2 }, { translateY: b.y - TILE / 2 }, { rotate: `${b.angle}deg` }],
    }
  })
  return (
    <Animated.View style={[liveTileFrame, placed]}>
      <Tile index={index} digit={digit} />
    </Animated.View>
  )
}

const liveTileFrame = { position: "absolute", left: 0, top: 0, width: TILE, height: TILE } as const

const useStyles = makeThemedStyles((t) => ({
  tiles: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: GROUND,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: TILE * 0.14,
  },
  tile: {
    width: TILE,
    height: TILE,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: TILE * 0.05,
    borderRadius: t.radius.xl,
  },
  digit: {
    fontFamily: fontFamily.brand,
    fontSize: TILE * 0.74,
    lineHeight: TILE * 0.74,
    includeFontPadding: false,
  },
  ground: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: GROUND,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.neutral.ink5,
  },
  hint: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    textAlign: "center",
    fontSize: t.fontSize["13"],
  },
}))
