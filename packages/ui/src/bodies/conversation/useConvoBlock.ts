import { useCallback, useState } from "react"
import { useBlockUser } from "../../data"
import { useT } from "../../i18n"

interface BlockTarget {
  id: string
  name: string
  isDm: boolean
}

export function useConvoBlock({
  peerId,
  title,
  closeMenu,
  onBack,
}: {
  peerId?: string
  title: string
  closeMenu: () => void
  onBack: () => void
}) {
  const { t } = useT("conversation")
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null)
  const blockUser = useBlockUser()
  const confirmBlock = useCallback(() => {
    const target = blockTarget
    if (!target) return
    blockUser.mutate(target.id, {
      onSuccess: () => {
        setBlockTarget(null)
        if (target.isDm) onBack()
      },
    })
  }, [blockTarget, blockUser, onBack])
  const startBlock = useCallback(() => {
    closeMenu()
    if (!peerId) return
    setBlockTarget({ id: peerId, name: title, isDm: true })
  }, [closeMenu, peerId, title])
  const onBlockAuthor = useCallback((author: { id: string; name?: string | null }) => {
    setBlockTarget({ id: author.id, name: author.name ?? t("block_confirm.this_person"), isDm: false })
  }, [t])
  const cancelBlock = useCallback(() => setBlockTarget(null), [])
  return { blockTarget, blockPending: blockUser.isPending, confirmBlock, startBlock, onBlockAuthor, cancelBlock }
}
