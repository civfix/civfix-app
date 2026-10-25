import React, { useCallback, useState } from "react"
import { Platform, ScrollView, View } from "react-native"
import Constants from "expo-constants"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  SettingsRow,
  SettingsSection,
  Text,
  useNavStore,
} from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { RouteHeader } from "@/components/ui/RouteHeader"
import { API_URL, SOURCE_COMMIT } from "@/config"
import { clearAllLocalDataAndSignOut } from "@/lib/clearLocalData"
import { goToMap } from "@/lib/goHome"
import { storage } from "@/lib/mmkv"
import { readPushRegistration } from "@/lib/pushRegistration"
import { queryClient } from "@/query/client"
import { clearQueryCache } from "@/query/mmkvPersister"
import { useLocationPrimerStore } from "@/store/locationPrimerStore"
import { useOnboardingStore } from "@/store/onboardingStore"
import { makeThemedStyles, useTheme } from "@/theme"

type DeveloperAction = "reset_onboarding" | "reset_location" | "clear_cache" | "clear_all"

const LOCAL_RESETS: Record<Exclude<DeveloperAction, "clear_all">, () => void> = {
  reset_onboarding: () => useOnboardingStore.getState().resetForNextLaunch(),
  reset_location: () => useLocationPrimerStore.getState().reset(),
  clear_cache: () => void clearQueryCache(queryClient),
}

export function DeveloperScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("settings")
  // The action outlives the open flag, so the sheet keeps its copy while it animates closed.
  const [action, setAction] = useState<DeveloperAction>("reset_onboarding")
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [pushRegistered] = useState(() => readPushRegistration(storage) !== null)

  const labels: Record<DeveloperAction, string> = {
    reset_onboarding: t("developer.reset_onboarding"),
    reset_location: t("developer.reset_location"),
    clear_cache: t("developer.clear_cache"),
    clear_all: t("developer.clear_all"),
  }
  const confirmations: Record<DeveloperAction, string> = {
    reset_onboarding: t("developer.reset_onboarding_confirm"),
    reset_location: t("developer.reset_location_confirm"),
    clear_cache: t("developer.clear_cache_confirm"),
    clear_all: t("developer.clear_all_confirm"),
  }
  const unknown = t("developer.unknown")

  const back = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace("/settings")),
    [router],
  )

  const ask = useCallback((next: DeveloperAction) => {
    setAction(next)
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    if (!running) setOpen(false)
  }, [running])

  const confirm = useCallback(async () => {
    if (!open || running) return
    if (action !== "clear_all") {
      LOCAL_RESETS[action]()
      setOpen(false)
      return
    }
    setRunning(true)
    try {
      await clearAllLocalDataAndSignOut()
    } finally {
      setRunning(false)
      setOpen(false)
    }
    // The sign-out reset leaves a signed-in user on the feed and never fires for a guest, whose status does
    // not change; the signed-out start is the map.
    useNavStore.getState().reset()
    goToMap(router, useNavStore.getState())
  }, [action, open, running, router])

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <RouteHeader title={t("developer.label")} onBack={back} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection>
          <SettingsRow icon="Globe" label={t("developer.api")} sub={API_URL} />
          <SettingsRow
            icon="Info"
            label={t("developer.app_version")}
            sub={Constants.expoConfig?.version ?? unknown}
          />
          <SettingsRow icon="Layers" label={t("developer.build")} sub={SOURCE_COMMIT || unknown} />
          <SettingsRow
            icon="Settings"
            label={t("developer.platform")}
            sub={`${Platform.OS} ${Platform.Version}`}
          />
          <SettingsRow
            icon="Bell"
            label={t("developer.push")}
            sub={pushRegistered ? t("developer.push_registered") : t("developer.push_not_registered")}
          />
        </SettingsSection>

        <SettingsSection style={styles.sectionGap}>
          <SettingsRow
            icon="Compass"
            label={labels.reset_onboarding}
            chevron={false}
            onPress={() => ask("reset_onboarding")}
          />
          <SettingsRow
            icon="MapPin"
            label={labels.reset_location}
            sub={t("developer.reset_location_note")}
            chevron={false}
            onPress={() => ask("reset_location")}
          />
          <SettingsRow
            icon="RefreshCw"
            label={labels.clear_cache}
            chevron={false}
            onPress={() => ask("clear_cache")}
          />
          <SettingsRow
            icon="Trash2"
            label={labels.clear_all}
            variant="destructive"
            onPress={() => ask("clear_all")}
          />
        </SettingsSection>
      </ScrollView>

      <ModalCardSheet
        visible={open}
        onClose={close}
        onCommit={() => void confirm()}
        headerIcon={action === "clear_all" ? "Trash2" : "TriangleAlert"}
        tone="danger"
        title={labels[action]}
        dismissLabel={t("developer.dismiss")}
        backdropDismissDisabled={running}
        actions={
          <>
            <SecondaryButton label={t("developer.cancel")} onPress={close} size="sm" disabled={running} />
            <PrimaryButton
              label={labels[action]}
              variant="destructive"
              onPress={() => void confirm()}
              loading={running}
              disabled={running}
            />
          </>
        }
      >
        <Text color={th.colors.textMuted}>{confirmations[action]}</Text>
      </ModalCardSheet>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["4"],
    paddingBottom: t.space["10"],
  },
  sectionGap: { marginTop: t.space["6"] },
}))
