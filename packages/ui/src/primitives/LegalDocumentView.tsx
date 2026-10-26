import React, { useCallback, useMemo, useState } from "react"
import { ScrollView, View, type LayoutChangeEvent } from "react-native"
import type { LegalBlock, LegalDocumentType } from "@civfix/contract"
import { safeDateFormat } from "@civfix/contract/datetime"
import { parseMarkdownInline } from "@civfix/contract/markdown"
import { headingLevel, makeThemedStyles } from "../theme"
import { Text } from "../typography"
import { useOpenExternal } from "../capabilities"
import { useLocale, useT } from "../i18n"
import { InlineRun } from "./Markdown"
import { legalDocumentTypeOfUrl, type ReadableLegalDocument } from "./legalDocument"
import { openLegalDocumentInPlace } from "./legalDocumentNav"

// Wide enough for a few words per line in a cell, and narrow enough that four columns fit the /legal page's
// 716 inner width; a table wider than its box scrolls sideways.
const TABLE_CELL_MIN_WIDTH = 176
const TABLE_BORDER_WIDTH = 1

const EFFECTIVE_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }

export interface LegalDocumentViewProps {
  document: ReadableLegalDocument
  current: boolean
  /** Shows a linked legal document itself; without it the link opens that document's own page in place. */
  onOpenLegalDocument?: ((type: LegalDocumentType) => void) | undefined
}

function Inline({ text, onOpenLink, keyPrefix }: { text: string; onOpenLink: (href: string) => void; keyPrefix: string }) {
  const nodes = useMemo(() => parseMarkdownInline(text).nodes, [text])
  return <InlineRun nodes={nodes} onOpenLink={onOpenLink} keyPrefix={keyPrefix} />
}

export function LegalDocumentView({ document, current, onOpenLegalDocument }: LegalDocumentViewProps) {
  const styles = useStyles()
  const { t } = useT("legal")
  const { locale } = useLocale()
  const openExternal = useOpenExternal()
  // Versions take effect at midnight UTC, so the date is the UTC one wherever it is read.
  const effective = safeDateFormat(document.effectiveAt, locale, EFFECTIVE_DATE, "UTC")

  const onOpenLink = useCallback(
    (href: string) => {
      const type = legalDocumentTypeOfUrl(href)
      if (type !== null && onOpenLegalDocument) {
        onOpenLegalDocument(type)
        return
      }
      if (type !== null && openLegalDocumentInPlace(type)) return
      void openExternal?.open(href)
    },
    [openExternal, onOpenLegalDocument],
  )

  const renderBlock = (block: LegalBlock, index: number) => {
    const key = `b${index}`
    switch (block.kind) {
      case "heading":
        return (
          <Text
            key={key}
            accessibilityRole="header"
            {...headingLevel(block.level)}
            style={block.level === 2 ? styles.heading2 : styles.heading3}
          >
            <Inline text={block.text} onOpenLink={onOpenLink} keyPrefix={key} />
          </Text>
        )
      case "paragraph":
        return (
          <Text key={key} style={styles.paragraph}>
            <Inline text={block.text} onOpenLink={onOpenLink} keyPrefix={key} />
          </Text>
        )
      case "list":
        return (
          <View key={key} style={styles.list}>
            {block.items.map((item, itemIndex) => (
              <View key={`${key}.${itemIndex}`} style={styles.listRow}>
                <Text style={styles.marker}>{block.ordered ? `${itemIndex + 1}.` : "•"}</Text>
                <Text style={styles.listText}>
                  <Inline text={item} onOpenLink={onOpenLink} keyPrefix={`${key}.${itemIndex}`} />
                </Text>
              </View>
            ))}
          </View>
        )
      case "table":
        return <LegalTable key={key} block={block} blockKey={key} onOpenLink={onOpenLink} />
    }
  }

  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={styles.title}>
        {document.title}
      </Text>
      <Text style={styles.meta}>{t("meta", { version: document.version, date: effective })}</Text>
      {current ? null : <Text style={styles.earlier}>{t("earlier_version", { date: effective })}</Text>}
      <View style={styles.blocks}>{document.blocks.map(renderBlock)}</View>
    </View>
  )
}

function LegalTable({
  block,
  blockKey,
  onOpenLink,
}: {
  block: Extract<LegalBlock, { kind: "table" }>
  blockKey: string
  onOpenLink: (href: string) => void
}) {
  const styles = useStyles()
  const [innerWidth, setInnerWidth] = useState(0)
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setInnerWidth(event.nativeEvent.layout.width - 2 * TABLE_BORDER_WIDTH)
  }, [])
  // Cells size from their text's one-line width otherwise, so every column would be as wide as the longest
  // cell and only the first would show. Equal columns, never under the minimum, wrap their text instead.
  const tableWidth = Math.max(innerWidth, block.columns.length * TABLE_CELL_MIN_WIDTH)
  const cellWidth = { width: tableWidth / block.columns.length }

  return (
    <ScrollView horizontal style={styles.tableScroll} onLayout={onLayout}>
      <View role="table" style={{ width: tableWidth }}>
        <View role="row" style={[styles.row, styles.headerRow]}>
          {block.columns.map((column, columnIndex) => (
            <Text
              key={`${blockKey}.h${columnIndex}`}
              role="columnheader"
              style={[styles.cell, cellWidth, styles.headerCell]}
            >
              <Inline text={column} onOpenLink={onOpenLink} keyPrefix={`${blockKey}.h${columnIndex}`} />
            </Text>
          ))}
        </View>
        {block.rows.map((row, rowIndex) => (
          <View key={`${blockKey}.r${rowIndex}`} role="row" style={[styles.row, styles.rowDivider]}>
            {row.map((cell, cellIndex) => (
              <Text
                key={`${blockKey}.r${rowIndex}.${cellIndex}`}
                role="cell"
                style={[styles.cell, cellWidth, styles.bodyCell]}
              >
                <Inline text={cell} onOpenLink={onOpenLink} keyPrefix={`${blockKey}.r${rowIndex}.${cellIndex}`} />
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["2"],
  },
  title: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["30"],
    lineHeight: t.fontSize["30"] * t.lineHeight.snug,
    color: t.colors.text,
  },
  meta: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    lineHeight: t.fontSize["14"] * t.lineHeight.base,
    color: t.colors.textSubtle,
  },
  earlier: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    lineHeight: t.fontSize["14"] * t.lineHeight.base,
    color: t.colors.text,
    backgroundColor: t.colors.bgAlt,
    borderRadius: t.radius.sm,
    paddingVertical: t.space["3"],
    paddingHorizontal: t.space["4"],
    marginTop: t.space["2"],
  },
  blocks: {
    gap: t.space["4"],
    marginTop: t.space["4"],
  },
  heading2: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["24"],
    lineHeight: t.fontSize["24"] * t.lineHeight.snug,
    color: t.colors.text,
    marginTop: t.space["4"],
  },
  heading3: {
    fontFamily: t.fontFamily.displaySemiBold,
    fontSize: t.fontSize["18"],
    lineHeight: t.fontSize["18"] * t.lineHeight.snug,
    color: t.colors.text,
    marginTop: t.space["2"],
  },
  paragraph: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["16"],
    lineHeight: t.fontSize["16"] * t.lineHeight.loose,
    color: t.colors.text,
  },
  list: {
    gap: t.space["2"],
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["2"],
    paddingLeft: t.space["2"],
  },
  marker: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["16"],
    lineHeight: t.fontSize["16"] * t.lineHeight.loose,
    color: t.colors.textSubtle,
    minWidth: t.space["5"],
  },
  listText: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["16"],
    lineHeight: t.fontSize["16"] * t.lineHeight.loose,
    color: t.colors.text,
  },
  tableScroll: {
    borderWidth: TABLE_BORDER_WIDTH,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
  },
  row: {
    flexDirection: "row",
  },
  headerRow: {
    backgroundColor: t.colors.bgAlt,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  cell: {
    flexShrink: 0,
    paddingVertical: t.space["3"],
    paddingHorizontal: t.space["4"],
    fontSize: t.fontSize["14"],
    lineHeight: t.fontSize["14"] * t.lineHeight.base,
  },
  headerCell: {
    fontFamily: t.fontFamily.bodyBold,
    color: t.colors.textMuted,
  },
  bodyCell: {
    fontFamily: t.fontFamily.bodyRegular,
    color: t.colors.text,
  },
}))
