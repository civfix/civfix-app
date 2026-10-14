import React from "react"
import { makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import type { Translate } from "../../i18n"
import { useScrollHost } from "../../shell/ScrollHost"
import { HostStateNotice } from "./HostStateNotice"

export type HostBodyStateKind = "loading" | "error" | "denied"

export interface HostBodyStateProps {
  state: HostBodyStateKind
  /** Bound to the screen's namespace, which carries the `state.*` copy for that screen. */
  t: Translate
}

export function HostBodyState({ state, t }: HostBodyStateProps) {
  const styles = useHostBodyStyles()
  const { ScrollView } = useScrollHost()

  if (state === "loading") {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.muted}>{t("state.loading")}</Text>
      </ScrollView>
    )
  }

  if (state === "error") {
    return <HostStateNotice icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />
  }

  return <HostStateNotice icon="Lock" title={t("state.denied_title")} body={t("state.denied_body")} />
}

export const useHostBodyStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  muted: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
}))
