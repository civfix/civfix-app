import React, { useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { makeThemedStyles, useTheme, MIN_TOUCH_TARGET } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { PrimaryButton } from "../../primitives"
import { useMyProfile } from "../../data"
import { useNavStore } from "../../nav"
import { useFeedShareRetry } from "../../report/submit"
import { useT } from "../../i18n"
import { FeedSharePreview } from "../FeedShareBlock"
import { LinkedReportCard } from "../LinkedReportCard"
import type { FeedShareOutcome } from "../feedShare"
import type { ShareSnapshot } from "./submitFlowModel"
import { SUBMIT_STATE_MAX_WIDTH } from "./flowStyles"

export function FeedShareOutcomeRow({ outcome, share }: { outcome: FeedShareOutcome; share: ShareSnapshot }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const me = useMyProfile().data?.profile ?? null
  const retryShare = useFeedShareRetry()
  const [state, setState] = useState<FeedShareOutcome>(outcome)
  const [retrying, setRetrying] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  if (state.status === "skipped") return null

  if (state.status === "posted") {
    const postId = state.postId
    return (
      <View style={styles.sharedBlock}>
        <Text style={styles.sharedHeading}>{t("share.posted_heading")}</Text>
        <FeedSharePreview
          authorName={me?.name ?? ""}
          authorId={me?.id}
          authorPhotoUrl={me?.avatarUrl ?? null}
          authorAvatar={me?.avatar ?? null}
          nowLabel={t("share.now")}
          caption={share.caption}
          footnote={t("share.fixes_hint")}
          onPress={() => {
            useNavStore.getState().finishReportFlow({ kind: "post-thread", id: postId })
          }}
          attachment={
            share.category ? (
              <LinkedReportCard
                report={{
                  id: "shared",
                  category: share.category,
                  title: share.title,
                  status: "published",
                  thumbUrl: share.thumbUrl,
                  addr: share.addr,
                }}
                layout="list"
                headline="title"
              />
            ) : null
          }
        />
      </View>
    )
  }

  const copy =
    state.reason === "rejected"
      ? t("share.failed_rejected")
      : state.reason === "rate-limited"
        ? t("share.failed_rate_limited")
        : t("share.failed")
  const retry = state.retry
  return (
    <View style={styles.shareFailRow}>
      <Icon icon={iconMap.AlertCircle} size={15} color={th.colors.brand.bloom} />
      <Text style={styles.shareFailText}>{copy}</Text>
      {state.retryable ? (
        <PrimaryButton
          label={t("share.retry")}
          variant="outline"
          disabled={retrying}
          onPress={() => {
            setRetrying(true)
            void retryShare(retry)
              .then((next) => {
                if (mounted.current) setState(next)
              })
              .finally(() => {
                if (mounted.current) setRetrying(false)
              })
          }}
        />
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  sharedBlock: {
    marginTop: t.space["6"],
    width: "100%",
    maxWidth: SUBMIT_STATE_MAX_WIDTH,
    gap: t.space["2"],
  },
  sharedHeading: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  shareFailRow: {
    marginTop: t.space["6"],
    width: "100%",
    maxWidth: SUBMIT_STATE_MAX_WIDTH,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  shareFailText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.accentText,
  },
}))
