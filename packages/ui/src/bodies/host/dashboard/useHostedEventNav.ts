import { useCallback } from "react"
import type { HostedEventDTO } from "@civfix/shared"
import { shareLink, useToast } from "../../../primitives"
import { useRequireAuth } from "../../../data"
import { useT } from "../../../i18n"
import { useNavStore } from "../../../nav"
import { openHostDashboard } from "../../hostDashboardTarget"
import { sharePathFor } from "./dashboardModel"

export type HostedEventHandler = (event: HostedEventDTO) => void

export interface HostedEventNav {
  onCreate: () => void
  onOpenEvent: HostedEventHandler
  onHostTools: HostedEventHandler
  onCheckIn: HostedEventHandler
  onOpenChat: HostedEventHandler
  onAnnounce: HostedEventHandler
  onShare: HostedEventHandler
  onEdit: HostedEventHandler
}

export function useHostedEventNav(activeOrgId: string | null): HostedEventNav {
  const { t } = useT("event-dashboard")
  const toast = useToast()
  const requireAuth = useRequireAuth()

  const onCreate = useCallback(() => {
    requireAuth(
      () => {
        useNavStore.getState().push({
          kind: "create-cleanup",
          ...(activeOrgId ? { organizationId: activeOrgId } : {}),
        })
      },
      { next: "/host" },
    )
  }, [activeOrgId, requireAuth])

  const onOpenEvent = useCallback((event: HostedEventDTO) => {
    useNavStore.getState().push({ kind: "cleanup", id: event.id, title: event.title })
  }, [])

  const onHostTools = useCallback((event: HostedEventDTO) => {
    openHostDashboard({ eventId: event.id })
  }, [])

  const onCheckIn = useCallback((event: HostedEventDTO) => {
    useNavStore.getState().push({ kind: "host-checkin", id: event.id })
  }, [])

  const onOpenChat = useCallback((event: HostedEventDTO) => {
    useNavStore.getState().push({
      kind: "thread",
      id: event.id,
      roomKind: "cleanup",
      title: event.title,
    })
  }, [])

  const onAnnounce = useCallback((event: HostedEventDTO) => {
    useNavStore.getState().push({ kind: "host-announce", id: event.id })
  }, [])

  const onShare = useCallback(
    (event: HostedEventDTO) => {
      void shareLink({ title: event.title, path: sharePathFor(event) }).then((result) => {
        if (result !== "copied") return
        toast.show(t("common-share:button.copied"), { variant: "success" })
      })
    },
    [t, toast],
  )

  const onEdit = useCallback((event: HostedEventDTO) => {
    useNavStore.getState().push({ kind: "edit-cleanup", id: event.id })
  }, [])

  return { onCreate, onOpenEvent, onHostTools, onCheckIn, onOpenChat, onAnnounce, onShare, onEdit }
}
