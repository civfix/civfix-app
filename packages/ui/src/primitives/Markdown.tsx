import React, { useMemo } from "react"
import { Text as RNText, View, type StyleProp, type ViewStyle } from "react-native"
import type { MarkdownInline, MarkdownNode } from "@civfix/shared/markdown"
import { parseMarkdownSubset } from "@civfix/shared/markdown"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"
import { useOpenExternal } from "../capabilities"

export interface MarkdownProps {
  source: string
  style?: StyleProp<ViewStyle>
  maxChars?: number
}

function InlineRun({
  nodes,
  onOpenLink,
  keyPrefix,
}: {
  nodes: readonly MarkdownInline[]
  onOpenLink: (href: string) => void
  keyPrefix: string
}) {
  const styles = useStyles()
  return (
    <>
      {nodes.map((node, index) => {
        const key = `${keyPrefix}.${index}`
        switch (node.type) {
          case "text":
            return <React.Fragment key={key}>{node.value}</React.Fragment>
          case "strong":
            return (
              <RNText key={key} style={styles.strong}>
                <InlineRun nodes={node.children} onOpenLink={onOpenLink} keyPrefix={key} />
              </RNText>
            )
          case "em":
            return (
              <RNText key={key} style={styles.em}>
                <InlineRun nodes={node.children} onOpenLink={onOpenLink} keyPrefix={key} />
              </RNText>
            )
          case "link":
            return (
              <RNText
                key={key}
                style={styles.link}
                accessibilityRole="link"
                onPress={() => onOpenLink(node.href)}
              >
                <InlineRun nodes={node.children} onOpenLink={onOpenLink} keyPrefix={key} />
              </RNText>
            )
        }
      })}
    </>
  )
}

export function Markdown({ source, style, maxChars }: MarkdownProps) {
  const styles = useStyles()
  const openExternal = useOpenExternal()

  const nodes = useMemo<MarkdownNode[]>(
    () => parseMarkdownSubset(source, maxChars != null ? { maxChars } : undefined),
    [source, maxChars],
  )

  const onOpenLink = React.useCallback(
    (href: string) => {
      void openExternal?.open(href)
    },
    [openExternal],
  )

  if (nodes.length === 0) return null

  return (
    <View style={[styles.root, style]}>
      {nodes.map((node, index) => {
        const key = `b${index}`
        if (node.type === "paragraph") {
          return (
            <Text key={key} style={styles.paragraph}>
              <InlineRun nodes={node.children} onOpenLink={onOpenLink} keyPrefix={key} />
            </Text>
          )
        }
        return (
          <View key={key} style={styles.list}>
            {node.items.map((item, itemIndex) => (
              <View key={`${key}.${itemIndex}`} style={styles.listRow}>
                <Text style={styles.bullet}>{node.ordered ? `${itemIndex + 1}.` : "•"}</Text>
                <Text style={styles.listText}>
                  <InlineRun
                    nodes={item.children}
                    onOpenLink={onOpenLink}
                    keyPrefix={`${key}.${itemIndex}`}
                  />
                </Text>
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["2"],
  },
  paragraph: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    lineHeight: 20,
    color: t.colors.text,
  },
  strong: {
    fontFamily: t.fontFamily.bodyBold,
  },
  em: {
    fontStyle: "italic",
  },
  link: {
    color: t.colors.accentText,
    textDecorationLine: "underline",
  },
  list: {
    gap: 2,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["2"],
  },
  bullet: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    lineHeight: 20,
    color: t.colors.textSubtle,
    minWidth: 16,
  },
  listText: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    lineHeight: 20,
    color: t.colors.text,
  },
}))
