import React from "react"
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { SOCIAL_PLATFORM_LABELS, socialLinkUrl, type SocialLinks } from "@civfix/shared"
import {
  focusRingProps,
  hitSlopToTarget,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
  webTransition,
} from "../theme"
import { useOpenExternal } from "../capabilities"
import { useT } from "../i18n"
import { SocialGlyph } from "./SocialGlyph"
import { useToast } from "./toastContext"
import { presentSocialPlatforms } from "./socialLinksModel"

export const SOCIAL_LINK_HIT_SIZE = 38
export const SOCIAL_LINK_GLYPH_SIZE = 20
const SOCIAL_LINK_HIT_SLOP = hitSlopToTarget(SOCIAL_LINK_HIT_SIZE)

export interface SocialLinksRowProps {
  links: SocialLinks | null | undefined
  style?: StyleProp<ViewStyle>
}

export function SocialLinksRow({ links, style }: SocialLinksRowProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("profile-view")
  const openExternal = useOpenExternal()
  const toast = useToast()
  const present = presentSocialPlatforms(links)
  if (present.length === 0) return null
  return (
    <View style={[styles.row, style]}>
      {present.map(({ platform, value }) => {
        const url = socialLinkUrl(platform, value)
        return (
          <Pressable
            key={platform}
            onPress={() => {
              const failed = () => toast.show(t("social.link_failed"), { variant: "error" })
              if (!openExternal) {
                failed()
                return
              }
              void openExternal.open(url).catch(failed)
            }}
            accessibilityRole="link"
            accessibilityLabel={t("social.link_a11y", { platform: SOCIAL_PLATFORM_LABELS[platform] })}
            hitSlop={SOCIAL_LINK_HIT_SLOP}
            {...focusRingProps}
            style={(state) => [
              styles.button,
              webTransition,
              webCursor(),
              webHover(state) ? styles.buttonHovered : null,
              state.pressed ? styles.buttonPressed : null,
            ]}
          >
            <SocialGlyph
              platform={platform}
              size={SOCIAL_LINK_GLYPH_SIZE}
              color={th.colors.textMuted}
            />
          </Pressable>
        )
      })}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: t.space["2"],
  },
  button: {
    width: SOCIAL_LINK_HIT_SIZE,
    height: SOCIAL_LINK_HIT_SIZE,
    borderRadius: SOCIAL_LINK_HIT_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  buttonHovered: {
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surfaceTint,
  },
  buttonPressed: {
    opacity: 0.8,
  },
}))
