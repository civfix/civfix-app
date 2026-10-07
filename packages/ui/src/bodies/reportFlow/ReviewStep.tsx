import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, StyleSheet } from "react-native"
import type { ReportCategory } from "@civfix/shared"
import { MAX_REPORT_ADDR_LENGTH } from "@civfix/shared"
import { type LatLng } from "@civfix/shared/geocode"
import { makeThemedStyles, useTheme, useLayoutMode } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { TextField, PrimaryButton, CategoryChip } from "../../primitives"
import { LocationPicker, reportPinTarget } from "../../map"
import { useResolveAddress, resolvedAddressValue, useResolveJurisdiction } from "../../data"
import { useDraftReportStore } from "../../report/draftStore"
import { routeCardState } from "../../report/routeCard"
import { useT } from "../../i18n"
import { AddressSearch, type AddressPick } from "../AddressSearch"
import { reportAddressPrefill } from "../reportAddressField"
import { FeedShareBlock } from "../FeedShareBlock"
import { LinkedReportCard } from "../LinkedReportCard"
import { buildReportPreviewCard } from "../feedShare"
import { CompactLocationField } from "./LocationStep"
import { useApproxCenter } from "./useApproxCenter"
import { useFlowStyles } from "./flowStyles"

export function ReviewStep({
  fromComposer,
  onRequestReveal,
  onOpenPicker,
}: {
  fromComposer: boolean
  onRequestReveal?: (y: number) => void
  onOpenPicker: () => void
}) {
  const styles = useStyles()
  const flowStyles = useFlowStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const draft = useDraftReportStore((s) => s.draft)
  const setShareToFeed = useDraftReportStore((s) => s.setShareToFeed)
  const setFeedCaption = useDraftReportStore((s) => s.setFeedCaption)
  const point = useMemo(
    () => (draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null),
    [draft.lat, draft.lng],
  )
  const setLocation = useDraftReportStore((s) => s.setLocation)
  const clearLocation = useDraftReportStore((s) => s.clearLocation)
  const setAddress = useDraftReportStore((s) => s.setAddress)
  const setPrefilledAddress = useDraftReportStore((s) => s.setPrefilledAddress)
  const [addrQuery, setAddrQuery] = useState("")

  const addressResolution = useResolveAddress(point)
  const nearAddress = useCallback((line: string) => t("review.where_near", { address: line }), [t])
  const prefillRef = useRef(setPrefilledAddress)
  prefillRef.current = setPrefilledAddress
  const settledAddress = resolvedAddressValue(addressResolution)
  useEffect(() => {
    const next = reportAddressPrefill({
      hasPoint: point !== null,
      resolution: settledAddress,
      currentAddr: draft.addr,
      addrEdited: draft.addrEdited,
      near: nearAddress,
    })
    if (next !== null) prefillRef.current(next)
  }, [point, settledAddress, draft.addr, draft.addrEdited, nearAddress])
  const layoutMode = useLayoutMode()
  const compact = layoutMode === "compact"
  const pickMode = layoutMode === "expanded" ? "main-map" : "standalone"

  const initialCenter = useApproxCenter(true, !compact)

  const onDropPin = useCallback(
    (lat: number, lng: number) => setLocation(lat, lng, "manual"),
    [setLocation],
  )
  const onPickPlace = useCallback(
    (place: AddressPick) => setLocation(place.lat, place.lng, "manual"),
    [setLocation],
  )
  const category = draft.category as ReportCategory | null
  const pin = useMemo(() => reportPinTarget(category), [category])

  return (
    <View style={flowStyles.stepBlock}>
      <View style={styles.summaryCard}>
        {category ? <CategoryChip category={category} showLabel size={36} /> : null}
        <Text style={styles.summaryTitle} numberOfLines={2}>
          {draft.title.trim() || t("review.untitled")}
        </Text>
        {draft.description.trim() ? (
          <Text style={styles.summaryDesc} numberOfLines={3}>
            {draft.description.trim()}
          </Text>
        ) : null}
      </View>

      <View style={styles.locationBlock}>
        <Text style={flowStyles.fieldLabel}>{t("review.where_label")}</Text>
        {!point ? (
          <View style={styles.validationRow}>
            <Icon icon={iconMap.AlertCircle} size={15} color={th.colors.brand.bloom} />
            <Text style={styles.errorText}>
              {t("review.no_location")}
            </Text>
          </View>
        ) : null}
        {compact ? (
          <CompactLocationField point={point} onOpenPicker={onOpenPicker} onClear={clearLocation} />
        ) : (
          <>
            <AddressSearch value={addrQuery} onChangeText={setAddrQuery} onPick={onPickPlace} />
            <LocationPicker value={point} onChange={onDropPin} onClear={clearLocation} initialCenter={initialCenter.center ?? undefined} centerSettled={initialCenter.settled} mode={pickMode} pin={pin} />
          </>
        )}
        <TextField
          placeholder={t("review.where_placeholder")}
          value={draft.addr ?? ""}
          onChangeText={setAddress}
          maxLength={MAX_REPORT_ADDR_LENGTH}
        />
      </View>

      <RouteCard point={point} />

      {fromComposer ? null : (
      <FeedShareBlock
        enabled={draft.shareToFeed}
        onToggle={setShareToFeed}
        caption={draft.feedCaption}
        onChangeCaption={setFeedCaption}
        label={t("share.label")}
        helper={t("share.helper")}
        captionPlaceholder={t("share.caption_placeholder")}
        captionA11yLabel={t("share.caption_a11y")}
        nowLabel={t("share.now")}
        onRequestReveal={onRequestReveal}
        attachment={
          <LinkedReportCard
            report={buildReportPreviewCard(draft, t("review.untitled"))}
            layout="list"
            headline="title"
          />
        }
      />
      )}
    </View>
  )
}

function RouteCard({ point }: { point: LatLng | null }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  return (
    <View style={styles.routeCard}>
      <View style={styles.routeIcon}>
        <Icon icon={iconMap.Building2} size={18} color={th.colors.sky["700"]} />
      </View>
      <View style={styles.routeText}>
        <Text style={styles.routeLabel}>{t("review.route_label")}</Text>
        <RouteStatus point={point} />
      </View>
    </View>
  )
}

function RouteStatus({ point }: { point: LatLng | null }) {
  const styles = useStyles()
  const { t } = useT("report-wizard")
  const jurisdiction = useResolveJurisdiction(point)
  const route = routeCardState(point !== null, jurisdiction)
  switch (route.kind) {
    case "no_point":
      return <Text style={styles.routeSub}>{t("review.route_no_point")}</Text>
    case "routable":
      return (
        <>
          <Text style={styles.routeName}>{route.name}</Text>
          <Text style={styles.routeSub}>{t("review.route_routable")}</Text>
        </>
      )
    case "new_area":
      return (
        <Text style={styles.routeSub}>
          {t("review.route_new_area", { cityState: route.cityState })}
        </Text>
      )
    case "uncovered":
      return (
        <Text style={styles.routeSub}>
          {t("review.route_uncovered")}
        </Text>
      )
    case "unavailable":
      return (
        <View style={styles.routeRetry}>
          <Text style={styles.routeSub}>{t("review.route_unavailable")}</Text>
          <PrimaryButton
            label={t("submit.try_again")}
            variant="outline"
            icon={iconMap.RefreshCw}
            onPress={() => void jurisdiction.refetch()}
          />
        </View>
      )
    default:
      return <Text style={styles.routeSub}>{t("review.route_resolving")}</Text>
  }
}

const useStyles = makeThemedStyles((t) => ({
  summaryCard: {
    gap: t.space["2"],
    padding: 14,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  summaryTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
  summaryDesc: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
    lineHeight: 18,
  },
  locationBlock: { gap: t.space["2"] },
  routeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["3"],
    padding: t.space["3"],
    borderRadius: t.radius.md,
    backgroundColor: t.colors.sky["50"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.sky["100"],
  },
  routeIcon: {
    width: 36,
    height: 36,
    borderRadius: t.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.neutral.card,
  },
  routeText: { flex: 1 },
  routeRetry: { gap: t.space["2"], alignItems: "flex-start" },
  routeLabel: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: t.colors.sky["700"],
  },
  routeName: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
    marginTop: 1,
  },
  routeSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  errorText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
}))
