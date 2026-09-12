import React from "react"
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import type { CleanupDTO, LinkedEventRef, ReportDTO } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  space,
  useTheme,
  webCursorPointer,
  webHover,
  webNoSelect,
  webScrimProps,
  webTransition,
} from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import type { IconName } from "../../typography"
import { useT } from "../../i18n"
import { useAttendingCleanups, useMyReports } from "../../data"
import type { AnchorRect } from "../../primitives/PopoverMenu"
import { LinkedEventCard } from "../LinkedEventCard"
import { LinkedReportCard } from "../LinkedReportCard"
import { buildComposerEventRef } from "../postComposerModel"

type AttachLevel = "menu" | "events" | "reports"

type MenuRowKey = "photo" | "camera" | "event" | "report"

const ROW_ICON: Record<MenuRowKey, IconName> = {
  photo: "Image",
  camera: "Camera",
  event: "Calendar",
  report: "MapPin",
}

const CARD_WIDTH = 264
const EDGE_MARGIN = space["2"]
const GAP = space["1"]

export interface ReplyAttachSheetProps {
  visible: boolean
  onClose: () => void
  anchor?: AnchorRect | null
  canAttachMedia: boolean
  onPhoto: () => void
  onCamera: () => void
  attachedEventId: string | null
  attachedReportId: string | null
  onSelectEvent: (event: LinkedEventRef, cleanup: CleanupDTO) => void
  onSelectReport: (report: ReportDTO) => void
}

export function ReplyAttachSheet({
  visible,
  onClose,
  anchor,
  canAttachMedia,
  onPhoto,
  onCamera,
  attachedEventId,
  attachedReportId,
  onSelectEvent,
  onSelectReport,
}: ReplyAttachSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("post-composer")
  const { width: winW, height: winH } = useWindowDimensions()
  const isWeb = Platform.OS === "web"
  const insets = React.useContext(SafeAreaInsetsContext)
  const [level, setLevel] = React.useState<AttachLevel>("menu")

  React.useEffect(() => {
    if (visible) setLevel("menu")
  }, [visible])

  const events = useAttendingCleanups()
  const reports = useMyReports()
  const eventItems = events.data ?? []
  const reportItems = React.useMemo(
    () => reports.data?.pages.flatMap((page) => page.items) ?? [],
    [reports.data],
  )

  const rows: readonly MenuRowKey[] = isWeb
    ? (["photo", "event", "report"] as const)
    : (["photo", "camera", "event", "report"] as const)

  const pendingActionRef = React.useRef<(() => void) | null>(null)
  const chooseRow = (key: MenuRowKey) => {
    if (key === "event") {
      setLevel("events")
      return
    }
    if (key === "report") {
      setLevel("reports")
      return
    }
    const action = key === "photo" ? onPhoto : onCamera
    if (Platform.OS === "ios") {
      pendingActionRef.current = action
      onClose()
      return
    }
    onClose()
    action()
  }
  const onModalDismiss = () => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (action) action()
  }

  const renderMenuRow = (key: MenuRowKey) => {
    const label = t(`attach.${key}`)
    const disabled = (key === "photo" || key === "camera") && !canAttachMedia
    return (
      <Pressable
        key={key}
        onPress={() => chooseRow(key)}
        disabled={disabled}
        accessibilityRole="menuitem"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        {...focusRingProps}
        style={(state) => [
          styles.row,
          webTransition,
          webCursorPointer,
          webHover(state) ? styles.rowHovered : null,
          state.pressed ? styles.rowPressed : null,
          disabled ? styles.rowDisabled : null,
        ]}
      >
        <Icon icon={iconMap[ROW_ICON[key]]} size={20} color={th.colors.accent} />
        <Text variant="body" numberOfLines={1} style={[styles.rowLabel, webNoSelect]}>
          {label}
        </Text>
      </Pressable>
    )
  }

  const pickerHeader = (title: string) => (
    <View style={styles.pickerHeader}>
      <Pressable
        onPress={() => setLevel("menu")}
        accessibilityRole="button"
        accessibilityLabel={t("attach.back")}
        hitSlop={8}
        {...focusRingProps}
        style={({ pressed }) => [styles.backButton, pressed ? styles.rowPressed : null]}
      >
        <Icon icon={iconMap.ChevronLeft} size={20} color={th.colors.text} />
      </Pressable>
      <Text style={styles.pickerTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  )

  const pickerBody = () => {
    const maxHeight = Math.round(winH * 0.5)
    if (level === "events") {
      return (
        <>
          {pickerHeader(t("attach.event"))}
          <ScrollView style={{ maxHeight }} contentContainerStyle={styles.pickerContent}>
            {events.isLoading ? <View style={styles.placeholder} /> : null}
            {!events.isLoading && eventItems.length === 0 ? (
              <Text style={styles.empty}>{t("empty_events")}</Text>
            ) : null}
            {eventItems.map((event) => (
              <LinkedEventCard
                key={event.id}
                event={buildComposerEventRef(event)}
                cleanup={event}
                layout="list"
                selectable
                selected={event.id === attachedEventId}
                onPress={() => {
                  onSelectEvent(buildComposerEventRef(event, new Date().toISOString()), event)
                  onClose()
                }}
              />
            ))}
          </ScrollView>
        </>
      )
    }
    return (
      <>
        {pickerHeader(t("attach.report"))}
        <ScrollView style={{ maxHeight }} contentContainerStyle={styles.pickerContent}>
          {reports.isLoading ? <View style={styles.placeholder} /> : null}
          {!reports.isLoading && reportItems.length === 0 ? (
            <Text style={styles.empty}>{t("empty_reports")}</Text>
          ) : null}
          {reportItems.map((report) => (
            <LinkedReportCard
              key={report.id}
              report={report}
              layout="list"
              selectable
              selected={report.id === attachedReportId}
              onPress={() => {
                onSelectReport(report)
                onClose()
              }}
            />
          ))}
          {reports.hasNextPage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: reports.isFetchingNextPage }}
              disabled={reports.isFetchingNextPage}
              onPress={() => {
                if (reports.hasNextPage && !reports.isFetchingNextPage) void reports.fetchNextPage()
              }}
              {...focusRingProps}
              style={({ pressed }) => [styles.listAction, pressed ? styles.rowPressed : null]}
            >
              <Text style={styles.listActionText}>{t("section.show_more")}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </>
    )
  }

  const content = level === "menu" ? <>{rows.map(renderMenuRow)}</> : pickerBody()

  if (isWeb) {
    let cardPosition: { bottom: number; left: number } | null = null
    if (anchor) {
      const maxLeft = Math.max(EDGE_MARGIN, winW - CARD_WIDTH - EDGE_MARGIN)
      cardPosition = {
        bottom: Math.max(EDGE_MARGIN, winH - anchor.y + GAP),
        left: Math.min(Math.max(anchor.x, EDGE_MARGIN), maxLeft),
      }
    }
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
        onDismiss={onModalDismiss}
      >
        <View style={styles.rootWeb}>
          <Pressable
            style={styles.backdropWeb}
            accessibilityRole="button"
            accessibilityLabel={t("attach.dismiss")}
            onPress={onClose}
            {...webScrimProps}
          />
          <View
            style={[styles.card, cardPosition ? { position: "absolute", ...cardPosition } : styles.cardCentered]}
            accessibilityRole="menu"
          >
            {content}
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={onModalDismiss}
    >
      <View style={styles.rootNative}>
        <Pressable
          style={styles.scrim}
          accessibilityRole="button"
          accessibilityLabel={t("attach.dismiss")}
          onPress={onClose}
          {...webScrimProps}
        />
        <View
          style={[styles.sheet, { paddingBottom: (insets?.bottom ?? 0) + space["3"] }]}
          accessibilityRole="menu"
        >
          {content}
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeThemedStyles((t) => ({
  rootWeb: {
    flex: 1,
  },
  backdropWeb: {
    ...StyleSheet.absoluteFillObject,
  },
  rootNative: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimModal,
  },
  card: {
    minWidth: CARD_WIDTH,
    maxWidth: 360,
    paddingVertical: t.space["1"],
    paddingHorizontal: t.space["1"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
  cardCentered: {
    alignSelf: "center",
    marginTop: "auto",
    marginBottom: "auto",
  },
  sheet: {
    paddingTop: t.space["2"],
    paddingHorizontal: t.space["2"],
    borderTopLeftRadius: t.radius.xl,
    borderTopRightRadius: t.radius.xl,
    backgroundColor: t.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.md,
  },
  rowHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  rowPressed: {
    backgroundColor: t.colors.surfaceTint,
    opacity: 0.85,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  pickerHeader: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
    paddingRight: t.space["3"],
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.md,
  },
  pickerTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 15,
    lineHeight: 20,
    color: t.colors.text,
  },
  pickerContent: {
    gap: 9,
    padding: 1,
    paddingBottom: t.space["2"],
  },
  placeholder: {
    height: 72,
    borderRadius: 16,
    backgroundColor: t.colors.surfaceTint,
  },
  empty: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: t.colors.surfaceTint,
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 13.5,
    lineHeight: 19,
    color: t.colors.textMuted,
  },
  listAction: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: t.radius.pill,
  },
  listActionText: {
    color: t.colors.accentText,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
  },
}))
