/** The uppercase section eyebrow and the "Hosting (3)" style subhead shared by the profile sections. */
import React from "react"
import { View } from "react-native"
import { Text } from "../../typography"
import { headingLevel } from "../../theme"
import { useSectionStyles } from "./sectionStyles"

// LEVELS (see `theme/webAffordances.headingLevel`): the profile panel's own title ("You" / the person's
// name) is the surface's level 1, an 11px eyebrow ("POSTS", "ACTIVITY") introduces a SECTION of it, and a
// "Hosting (3)" subhead sits inside a section. Before this, RNW rendered all three - and the panel title,
// and the brand wordmark - as peer <h1>s, so heading navigation on /profile listed five equals.
export function SectionEyebrow({ children }: { children: string }) {
  const sectionStyles = useSectionStyles()
  return (
    <Text style={sectionStyles.eyebrow} accessibilityRole="header" {...headingLevel(2)}>
      {children}
    </Text>
  )
}

export function SubHead({ label, count }: { label: string; count?: number }) {
  const sectionStyles = useSectionStyles()
  return (
    <View style={sectionStyles.subhead}>
      <Text style={sectionStyles.subheadText} accessibilityRole="header" {...headingLevel(3)}>
        {label}
      </Text>
      {count != null ? (
        <View style={sectionStyles.subheadCt}>
          <Text style={sectionStyles.subheadCtText}>{count}</Text>
        </View>
      ) : null}
    </View>
  )
}
