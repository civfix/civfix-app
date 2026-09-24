import React, { useCallback, useRef, useState } from "react"
import { View, Pressable, ScrollView, ActivityIndicator } from "react-native"
import { MAX_REPORT_MEDIA } from "@civfix/shared"
import {
  makeThemedStyles,
  useTheme,
  focusRingProps,
  DISABLED_OPACITY_FAINT,
  MIN_TOUCH_TARGET,
  type LayoutMode,
} from "../../theme"
import { alpha } from "../../theme/alpha"
import { Text, Icon, iconMap } from "../../typography"
import { MediaPreview } from "../../primitives"
import { useCamera } from "../../capabilities"
import type { CapturedMedia } from "../../capabilities"
import { useDraftReportStore, captureSeedsNewReport } from "../../report/draftStore"
import type { DraftMedia } from "../../report/draftStore"
import {
  useCaptureDropTarget,
  captureDropTargetStyle,
  captureDropActiveStyleFor,
  type CaptureDropTarget,
  type DroppedItem,
} from "../../report/captureDropTarget"
import { useT } from "../../i18n"
import { useFlowStyles } from "./flowStyles"

type CaptureSource = "capture" | "library"

export function CaptureStep({ mode }: { mode: LayoutMode }) {
  const { t } = useT("report-wizard")
  const camera = useCamera()
  const media = useDraftReportStore((s) => s.draft.media)
  const startFromCapture = useDraftReportStore((s) => s.startFromCapture)
  const addCapture = useDraftReportStore((s) => s.addCapture)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [hint, setHint] = useState<string | null>(null)

  const land = useCallback(
    async (produce: () => Promise<CapturedMedia | null>) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      setHint(null)
      try {
        const captured = await produce()
        if (captured) {
          if (captureSeedsNewReport(useDraftReportStore.getState().draft)) startFromCapture(captured)
          else addCapture(captured)
        }
      } catch {
        setHint(t("capture.camera_error"))
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [startFromCapture, addCapture, t],
  )

  const run = useCallback(
    (kind: CaptureSource) => {
      void land(
        kind === "capture"
          ?
            () => camera.capture({ orientation: "portrait" })
          : () => camera.pickFromLibrary(),
      )
    },
    [camera, land],
  )

  const acceptFile = camera.acceptFile
  const onDropFiles = useCallback(
    (items: readonly DroppedItem[]) => {
      const first = items[0]
      if (first === undefined || !acceptFile) return
      void land(() => acceptFile(first))
    },
    [acceptFile, land],
  )
  const drop = useCaptureDropTarget(mode === "expanded" && acceptFile != null, onDropFiles)

  if (media.length > 0) return <CapturedMediaStrip media={media} busy={busy} hint={hint} onRun={run} />
  return <CaptureCard fill={mode === "expanded"} busy={busy} hint={hint} drop={drop} onRun={run} />
}

function CapturedMediaStrip({
  media,
  busy,
  hint,
  onRun,
}: {
  media: readonly DraftMedia[]
  busy: boolean
  hint: string | null
  onRun: (kind: CaptureSource) => void
}) {
  const styles = useStyles()
  const flowStyles = useFlowStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const removeMedia = useDraftReportStore((s) => s.removeMedia)
  const atCap = media.length >= MAX_REPORT_MEDIA
  return (
    <View style={flowStyles.stepBlock}>
      <Text style={flowStyles.fieldLabel}>{t("capture.label_filled")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.captureStrip}
      >
        {media.map((m) => (
          <View key={m.id} style={styles.captureThumbWrap}>
            <MediaPreview uri={m.uri} kind={m.kind} aspectRatio={1} style={styles.captureThumb} />
            <Pressable
              onPress={() => removeMedia(m.id)}
              accessibilityRole="button"
              accessibilityLabel={t("capture.remove_item_a11y")}
              hitSlop={6}
              {...focusRingProps}
              style={({ pressed }) => [styles.captureRemove, pressed ? flowStyles.pressed : null]}
            >
              <View style={styles.captureRemoveDisc}>
                <Icon icon={iconMap.Close} size={13} color={th.colors.onScrim} />
              </View>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <View style={styles.captureActions}>
        <Pressable
          onPress={() => onRun("capture")}
          disabled={busy || atCap}
          accessibilityRole="button"
          accessibilityLabel={t("capture.add_camera_a11y")}
          {...focusRingProps}
          style={({ pressed }) => [
            styles.retakeBtn,
            pressed ? flowStyles.pressed : null,
            atCap ? styles.retakeDisabled : null,
          ]}
        >
          <Icon icon={iconMap.Camera} size={16} color={th.colors.textMuted} />
          <Text style={styles.retakeText}>{t("capture.camera")}</Text>
        </Pressable>
        <Pressable
          onPress={() => onRun("library")}
          disabled={busy || atCap}
          accessibilityRole="button"
          accessibilityLabel={t("capture.add_library_a11y")}
          {...focusRingProps}
          style={({ pressed }) => [
            styles.retakeBtn,
            pressed ? flowStyles.pressed : null,
            atCap ? styles.retakeDisabled : null,
          ]}
        >
          <Icon icon={iconMap.Plus} size={16} color={th.colors.textMuted} />
          <Text style={styles.retakeText}>{t("capture.library")}</Text>
        </Pressable>
      </View>
      <Text style={styles.captureHint}>
        {atCap
          ? t("capture.hint_at_cap", { max: MAX_REPORT_MEDIA })
          : t("capture.hint_add_more", { count: MAX_REPORT_MEDIA })}
      </Text>
      {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  )
}

function CaptureCard({
  fill,
  busy,
  hint,
  drop,
  onRun,
}: {
  fill: boolean
  busy: boolean
  hint: string | null
  drop: CaptureDropTarget
  onRun: (kind: CaptureSource) => void
}) {
  const styles = useStyles()
  const flowStyles = useFlowStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  return (
    <View style={[flowStyles.stepBlock, fill ? styles.stepBlockFill : null]}>
      <Pressable
        ref={drop.ref}
        onPress={() => onRun("capture")}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t("capture.capture_a11y")}
        {...focusRingProps}
        style={({ pressed }) => [
          styles.photoDrop,
          fill ? styles.photoDropFill : null,
          th.shadows.pin,
          drop.active ? captureDropTargetStyle : null,
          drop.dragging ? captureDropActiveStyleFor(th) : null,
          pressed ? flowStyles.pressed : null,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={th.colors.neutral.card} />
        ) : (
          <Icon icon={iconMap.Camera} size={30} color={th.colors.neutral.card} />
        )}
        <Text style={styles.photoDropTitle}>{t("capture.drop_title")}</Text>
        <Text style={styles.photoDropSub}>{t("capture.drop_sub")}</Text>
      </Pressable>
      <Pressable
        onPress={() => onRun("library")}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t("capture.choose_library_a11y")}
        {...focusRingProps}
        style={({ pressed }) => [styles.libraryLink, pressed ? flowStyles.pressed : null]}
      >
        <Icon icon={iconMap.Plus} size={15} color={th.colors.textMuted} />
        <Text style={styles.libraryLinkText}>{t("capture.choose_library")}</Text>
      </Pressable>
      {drop.active ? (
        <Text variant="caption" color={th.colors.textSubtle} style={styles.dragHint}>
          {t("capture.drag_hint")}
        </Text>
      ) : null}
      {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  stepBlockFill: { flex: 1, justifyContent: "flex-start" },
  photoDrop: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 168,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bloom["700"],
    paddingHorizontal: t.space["6"],
  },
  photoDropFill: { flex: 1, maxHeight: 520 },
  photoDropTitle: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: t.fontSize["16"],
    color: t.colors.neutral.card,
    marginTop: t.space["1"],
  },
  photoDropSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.neutral.card,
    textAlign: "center",
  },
  libraryLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    maxWidth: "100%",
    gap: 6,
    paddingVertical: t.space["2"],
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
  },
  dragHint: {
    textAlign: "center",
    marginTop: -t.space["2"],
  },
  libraryLinkText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  captureActions: {
    flexDirection: "row",
    gap: t.space["3"],
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: MIN_TOUCH_TARGET,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  retakeText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.textMuted,
  },
  retakeDisabled: {
    opacity: DISABLED_OPACITY_FAINT,
  },
  captureStrip: {
    flexDirection: "row",
    gap: t.space["2"],
    paddingVertical: t.space["1"],
  },
  captureThumbWrap: {
    width: 96,
    position: "relative",
  },
  captureThumb: {
    borderRadius: t.radius.md,
  },
  captureRemove: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  captureRemoveDisc: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(t.colors.shadowColor, 0.62),
  },
  captureHint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    marginTop: t.space["1"],
  },
  hintText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    textAlign: "center",
  },
}))
