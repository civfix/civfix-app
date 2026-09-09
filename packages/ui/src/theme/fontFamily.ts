/** Host-registered font aliases shared by native and web UI consumers. */
export const fontFamily = {
  // Bricolage Grotesque (display / headings)
  displayRegular: "BricolageGrotesque_400Regular",
  displayMedium: "BricolageGrotesque_500Medium",
  displaySemiBold: "BricolageGrotesque_600SemiBold",
  displayBold: "BricolageGrotesque_700Bold",
  // Hanken Grotesk (body / UI)
  bodyRegular: "HankenGrotesk_400Regular",
  bodyMedium: "HankenGrotesk_500Medium",
  bodySemiBold: "HankenGrotesk_600SemiBold",
  bodyBold: "HankenGrotesk_700Bold",
  // Hanken Grotesk 800: eyebrows, feed kickers, unread badges, group avatars.
  bodyExtraBold: "HankenGrotesk_800ExtraBold",
  // JetBrains Mono (numeric / mono)
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
  // Baloo 2 is reserved for the per-letter civfix wordmark.
  brand: "Baloo2_800ExtraBold",
} as const
