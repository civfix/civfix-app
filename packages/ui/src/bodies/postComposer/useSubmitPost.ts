import { useEffect, useRef } from "react"
import type { PostComposeInput, PostDTO } from "@civfix/shared"
import { useHaptics } from "../../capabilities"
import { useCreatePost } from "../../data/hooks/posts"
import { useT } from "../../i18n"
import { useToast } from "../../primitives/Toast"
import {
  restoreFailedPostSubmit,
  selectPostComposerDraft,
  usePostComposerStore,
  type PostComposerMode,
} from "../postComposerStore"

export interface PreparedPostSubmit {
  input: PostComposeInput
  optimistic: PostDTO
  /** The fresh draft the store resets to the moment the post is handed off. */
  resetTo: { mode: PostComposerMode; targetPostId: string | null }
}

/**
 * The post-composer submit both the full-screen and the inline feed composer run. The outcome is read from
 * the mutation PROMISE, not per-call callbacks, because TanStack drops those once the composer unmounts: a
 * failed post must still restore its text and tell the user after the composer is gone.
 */
export function useSubmitPost() {
  const { t } = useT("post-composer")
  const haptics = useHaptics()
  const toast = useToast()
  const create = useCreatePost()
  /** Set SYNCHRONOUSLY: React state is async and a fast double-tap outruns `isPending`. */
  const submittingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const submit = (prepare: () => PreparedPostSubmit | null, onPosted: (post: PostDTO, input: PostComposeInput) => void) => {
    if (submittingRef.current) return
    const prepared = prepare()
    if (!prepared) return
    submittingRef.current = true
    const staged = selectPostComposerDraft(usePostComposerStore.getState())
    usePostComposerStore.getState().reset(prepared.resetTo)
    create.mutateAsync({ input: prepared.input, optimistic: prepared.optimistic }, {
      onSuccess: (post) => {
        haptics.success()
        onPosted(post, prepared.input)
      },
      onSettled: () => {
        submittingRef.current = false
      },
    }).catch(() => {
      haptics.error()
      const restored = restoreFailedPostSubmit(staged)
      if (!mountedRef.current) {
        toast.show(t(restored ? "submit_error_restored" : "submit_error"), { variant: "error" })
      }
    })
  }

  return { create, submit }
}
