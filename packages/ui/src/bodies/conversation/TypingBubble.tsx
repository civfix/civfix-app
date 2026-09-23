/** The "someone is typing" row: a their-side bubble carrying three looping dots. */
import React, { useEffect, useRef } from "react"
import { Animated, Platform, View } from "react-native"
import { Text } from "../../typography"
import { useReducedMotion } from "../../theme/useReducedMotion"
import { useT } from "../../i18n"
import { useConversationStyles } from "./styles"

function TypingDots() {
  const styles = useConversationStyles()
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current
  // REDUCED MOTION: a typing indicator is the one animation in the conversation that never stops on its
  // own, so it is also the one most worth silencing. `useReducedMotion` is the package's shared
  // AccessibilityInfo store (one query + one listener for the whole app, `prefers-reduced-motion` on
  // web); `null` means "not answered yet", which animates - the setting is off for almost everyone.
  const reduceMotion = useReducedMotion() === true
  useEffect(() => {
    if (reduceMotion) {
      // Three static dots at full ink: the row still READS as a typing indicator without the travel.
      for (const value of dots) value.setValue(1)
      return
    }
    const useNative = Platform.OS !== "web"
    const anims = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: useNative }),
          Animated.timing(v, { toValue: 0, duration: 320, useNativeDriver: useNative }),
          Animated.delay(640 - i * 160),
        ]),
      ),
    )
    anims.forEach((a) => a.start())
    return () => anims.forEach((a) => a.stop())
  }, [dots, reduceMotion])
  return (
    <View style={styles.typingDots}>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
              transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
            },
          ]}
        />
      ))}
    </View>
  )
}

export const TypingBubble = React.memo(function TypingBubble({ name, color }: { name: string | null; color: string }) {
  const styles = useConversationStyles()
  const { t } = useT("conversation")
  return (
    <View
      style={[styles.bubbleWrap, styles.bubbleWrapTheirs, styles.bubbleWrapGroupStart]}
      // A native View exposes its label only as one accessible element. No live region: busy rooms would chatter.
      accessible
      accessibilityLabel={name ? t("typing.indicator_named", { name }) : t("typing.indicator")}
    >
      {name ? (
        <Text style={[styles.who, { color }]} numberOfLines={1}>
          {name}
        </Text>
      ) : null}
      <View style={[styles.bubble, styles.bubbleTheirs, styles.typingBubble]}>
        <TypingDots />
      </View>
    </View>
  )
})
