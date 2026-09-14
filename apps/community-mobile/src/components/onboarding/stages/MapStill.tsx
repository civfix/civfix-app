import React, { useCallback, useMemo, useState } from "react"
import {
  Image,
  StyleSheet,
  View,
  type ImageRequireSource,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import type { ColorSchemeName } from "@civfix/shared/tokens"
import { DEFAULT_ATTRIBUTION, Text, basemapPaper } from "@civfix/ui"
import { makeThemedStyles, useTheme } from "@/theme"
import {
  ONBOARDING_MAP_SCENES,
  pointInBox,
  type BoxPoint,
  type BoxSize,
  type GeoPoint,
  type OnboardingMapStage,
} from "../onboardingMapScenes"

const STILLS: Readonly<Record<OnboardingMapStage, Readonly<Record<ColorSchemeName, ImageRequireSource>>>> = {
  report: {
    light: require("../../../../assets/onboarding/report-light.png"),
    dark: require("../../../../assets/onboarding/report-dark.png"),
  },
  track: {
    light: require("../../../../assets/onboarding/track-light.png"),
    dark: require("../../../../assets/onboarding/track-dark.png"),
  },
  together: {
    light: require("../../../../assets/onboarding/together-light.png"),
    dark: require("../../../../assets/onboarding/together-dark.png"),
  },
}

const EMPTY_BOX: BoxSize = { width: 0, height: 0 }

export interface MapStillFrame {
  at(point: GeoPoint): BoxPoint
}

export type AttributionEdge = "bottom" | "top"

export function spotStyle(at: BoxPoint, offsetX: number, offsetY: number): ViewStyle {
  return {
    position: "absolute",
    left: at.left + offsetX,
    top: at.top + offsetY,
  }
}

export function MapStill({
  stage,
  style,
  attributionEdge = "bottom",
  children,
}: {
  stage: OnboardingMapStage
  style?: StyleProp<ViewStyle>
  attributionEdge?: AttributionEdge
  children?: (frame: MapStillFrame) => React.ReactNode
}) {
  const th = useTheme()
  const styles = useStyles()
  const scene = ONBOARDING_MAP_SCENES[stage]
  const [box, setBox] = useState<BoxSize>(EMPTY_BOX)

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
  }, [])

  const frame = useMemo<MapStillFrame | null>(
    () =>
      box.width > 0 && box.height > 0
        ? { at: (point) => pointInBox(scene, point, box) }
        : null,
    [scene, box],
  )

  return (
    <View style={style} onLayout={onLayout}>
      <View style={[styles.surface, { backgroundColor: basemapPaper(th.scheme) }]}>
        <Image
          source={STILLS[stage][th.scheme]}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          fadeDuration={0}
          accessible={false}
        />
        <View
          pointerEvents="none"
          style={[styles.attribution, attributionEdge === "top" ? styles.attributionTop : styles.attributionBottom]}
        >
          <Text variant="caption" color={th.colors.textSubtle} numberOfLines={1}>
            {DEFAULT_ATTRIBUTION}
          </Text>
        </View>
      </View>
      {frame && children ? children(frame) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  surface: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    borderRadius: t.radius.lg,
  },
  attribution: {
    position: "absolute",
    right: t.space["2"],
    paddingHorizontal: t.space["2"],
    paddingVertical: 2,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    opacity: 0.88,
  },
  attributionBottom: {
    bottom: t.space["2"],
  },
  attributionTop: {
    top: t.space["2"],
  },
}))
