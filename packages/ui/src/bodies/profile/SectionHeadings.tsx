import React from "react"
import { View } from "react-native"
import { Text } from "../../typography"
import { headingLevel } from "../../theme"
import { useSectionStyles } from "./sectionStyles"

// Heading levels (see `theme/webAffordances.headingLevel`): the profile panel's own title ("You" / the
// person's name) is level 1, an eyebrow ("POSTS", "ACTIVITY") introduces a section of it, and a
// "Hosting (3)" subhead sits inside a section. Without explicit levels RNW renders them all as peer <h1>s.
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
