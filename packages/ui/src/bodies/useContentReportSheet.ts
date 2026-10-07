import { useCallback, useState } from "react"
import type { ContentReportReason, ContentReportSubject } from "@civfix/shared"
import { useToast } from "../primitives"
import { useReportContent } from "../data"

export interface ContentReportTarget {
  subjectType: ContentReportSubject
  subjectId: string
  label: string
}

/**
 * The caller passes the toast copy already translated so its `t("...")` literal stays at the call site,
 * where `i18n:check` resolves it against the right namespace.
 */
export function useContentReportSheet({ submittedToast }: { submittedToast: string }) {
  const toast = useToast()
  const reportContent = useReportContent()
  const [target, setTarget] = useState<ContentReportTarget | null>(null)
  const open = useCallback(
    (next: ContentReportTarget) => {
      reportContent.reset()
      setTarget(next)
    },
    [reportContent],
  )
  const close = useCallback(() => {
    if (reportContent.isPending) return
    setTarget(null)
  }, [reportContent.isPending])
  const submit = useCallback(
    (reason: ContentReportReason, details?: string) => {
      if (!target) return
      reportContent.mutate(
        {
          subjectType: target.subjectType,
          subjectId: target.subjectId,
          reason,
          ...(details ? { details } : {}),
        },
        {
          onSuccess: () => {
            setTarget(null)
            toast.show(submittedToast, { variant: "success" })
          },
        },
      )
    },
    [target, reportContent, toast, submittedToast],
  )
  return {
    target,
    pending: reportContent.isPending,
    failed: reportContent.isError,
    open,
    close,
    submit,
  }
}
