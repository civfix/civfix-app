import React from "react"
import { View, ActivityIndicator, type TextStyle } from "react-native"
import { makeThemedStyles, useTheme, useLayoutMode, type Theme } from "../theme"
import { Text, iconMap, type LucideIcon } from "../typography"
import { PrimaryButton, type ButtonVariant } from "./PrimaryButton"
import { DETAILS_ARE_FULL_PAGE } from "../shell/detailPresentationPlatform"
import { useT } from "../i18n"
import { SkeletonList, type SkeletonRowKind } from "./skeleton"

export type StateTone = "bloom" | "moss" | "neutral"
export type StateVariant = "list" | "detail"

function toneBg(tone: StateTone, t: Theme): string {
  switch (tone) {
    case "moss":
      return t.colors.moss["50"]
    case "neutral":
      return t.colors.neutral.paper2
    default:
      return t.colors.bloom["50"]
  }
}

function toneIcon(tone: StateTone, t: Theme): string {
  switch (tone) {
    case "moss":
      return t.colors.brand.moss
    case "neutral":
      return t.colors.textSubtle
    default:
      return t.colors.brand.bloom
  }
}

export function CenterBox({
  children,
  variant = "list",
}: {
  children: React.ReactNode
  variant?: StateVariant
}) {
  const styles = useStyles()
  const inPullUpSheet = useLayoutMode() === "compact" && !DETAILS_ARE_FULL_PAGE
  const base = variant === "detail" ? styles.centerDetail : styles.centerList
  return <View style={[base, inPullUpSheet ? styles.centerCompact : null]}>{children}</View>
}

export function LoadingState({
  variant = "list",
  skeleton,
  rows = 6,
}: {
  variant?: StateVariant
  skeleton?: SkeletonRowKind
  rows?: number
}) {
  const styles = useStyles()
  const t = useTheme()
  if (skeleton) return <SkeletonList rows={rows} kind={skeleton} style={styles.skeletonList} />
  return (
    <CenterBox variant={variant}>
      <ActivityIndicator color={t.colors.brand.bloom} />
    </CenterBox>
  )
}

function IconBubble({
  icon: IconCmp,
  tone,
  iconColor,
  iconSize = 28,
}: {
  icon: LucideIcon
  tone: StateTone
  iconColor?: string
  iconSize?: number
}) {
  const styles = useStyles()
  const t = useTheme()
  return (
    <View style={[styles.bubble, { backgroundColor: toneBg(tone, t) }]}>
      <IconCmp size={iconSize} color={iconColor ?? toneIcon(tone, t)} />
    </View>
  )
}

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  body: string
  tone?: StateTone
  iconColor?: string
  iconSize?: number
  cta?: {
    label: string
    icon?: LucideIcon
    onPress: () => void
    variant?: ButtonVariant
  }
  variant?: StateVariant
}

export function EmptyState({
  icon,
  title,
  body,
  tone = "bloom",
  iconColor,
  iconSize = 28,
  cta,
  variant = "list",
}: EmptyStateProps) {
  const styles = useStyles()
  const t = useTheme()
  return (
    <CenterBox variant={variant}>
      <IconBubble icon={icon} tone={tone} iconColor={iconColor} iconSize={iconSize} />
      <Text variant="title" style={styles.title}>
        {title}
      </Text>
      <Text variant="body" color={t.colors.textMuted} style={bodyStyle(variant, styles)}>
        {body}
      </Text>
      {cta ? (
        <PrimaryButton
          label={cta.label}
          icon={cta.icon}
          variant={cta.variant}
          onPress={cta.onPress}
          style={styles.cta}
        />
      ) : null}
    </CenterBox>
  )
}

export interface SignInPromptProps {
  icon: LucideIcon
  title: string
  body: string
  onSignIn: () => void
  tone?: StateTone
  iconSize?: number
  variant?: StateVariant
}

export function SignInPrompt({
  icon,
  title,
  body,
  onSignIn,
  tone = "bloom",
  iconSize = 30,
  variant = "list",
}: SignInPromptProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("common")
  return (
    <CenterBox variant={variant}>
      <IconBubble icon={icon} tone={tone} iconSize={iconSize} />
      <Text variant="title" style={styles.title}>
        {title}
      </Text>
      <Text variant="body" color={th.colors.textMuted} style={styles.body}>
        {body}
      </Text>
      <PrimaryButton
        label={t("sign_in")}
        icon={iconMap.LogIn}
        onPress={onSignIn}
        style={styles.cta}
      />
    </CenterBox>
  )
}

function bodyStyle(variant: StateVariant, styles: StateViewStyles): TextStyle {
  return variant === "detail" ? styles.bodyDetail : styles.body
}

type StateViewStyles = ReturnType<typeof useStyles>

const useStyles = makeThemedStyles((t) => ({
  skeletonList: { paddingTop: t.space["2"] },
  centerList: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space["8"],
    paddingTop: t.space["16"],
  },
  centerDetail: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space["8"],
  },
  centerCompact: {
    justifyContent: "flex-start",
    paddingTop: t.space["8"],
  },
  bubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: t.space["4"],
  },
  title: { textAlign: "center", marginBottom: t.space["2"] },
  body: { textAlign: "center", lineHeight: 20, maxWidth: 300 },
  bodyDetail: { textAlign: "center", lineHeight: 20, maxWidth: 280 },
  cta: { marginTop: t.space["6"], minWidth: 220 },
}))
