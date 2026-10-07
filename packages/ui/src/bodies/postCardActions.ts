import React from "react"
import type { PostDTO } from "@civfix/shared"
import { usePopoverAnchor, type AnchorRect } from "../primitives/PopoverMenu"
import { usePostMediaLightbox } from "../lightbox/usePostMediaLightbox"
import { useNavStore } from "../nav/useNavStore"
import type { DetailEntry } from "../nav/types"
import { postMenuSubject, type PostIdentity } from "./postCardModel"

const EMPTY_MEDIA: PostDTO["media"] = []

export function usePostOverflowMenuState(post: PostDTO) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [menuAnchor, setMenuAnchor] = React.useState<AnchorRect | null>(null)
  const menuTrigger = usePopoverAnchor(setMenuAnchor)
  const openMenu = React.useCallback(() => {
    menuTrigger.measure()
    setMenuOpen(true)
  }, [menuTrigger])
  const closeMenu = React.useCallback(() => setMenuOpen(false), [])
  const menuSubject = React.useMemo(() => postMenuSubject(post), [post])
  return { menuOpen, menuAnchor, menuTrigger, openMenu, closeMenu, menuSubject }
}

export function usePostRowActions({
  post,
  identity,
  onOpenEntry,
}: {
  post: PostDTO
  identity: PostIdentity
  onOpenEntry?: (entry: DetailEntry) => void
}) {
  const push = useNavStore((state) => state.push)
  const openEntry = onOpenEntry ?? push
  const openPerson = React.useCallback(
    (personId: string) => openEntry({ kind: "person", id: personId }),
    [openEntry],
  )
  const onQuote = React.useCallback(
    () => openEntry({ kind: "composer", composerMode: "quote", targetPostId: post.id }),
    [openEntry, post.id],
  )
  const openIdentity = React.useCallback(() => {
    if (identity.organization) {
      openEntry({ kind: "org", slug: identity.organization.slug })
      return
    }
    if (identity.personId) openPerson(identity.personId)
  }, [identity, openEntry, openPerson])
  const openActingPerson = React.useCallback(() => {
    if (identity.personId) openPerson(identity.personId)
  }, [identity, openPerson])
  const menu = usePostOverflowMenuState(post)
  const media = post.media ?? EMPTY_MEDIA
  const openMedia = usePostMediaLightbox(media)
  return { openEntry, openPerson, onQuote, openIdentity, openActingPerson, menu, media, openMedia }
}
