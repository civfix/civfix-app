import type { ContextMenuAction, PopoverMenuItem } from "../../primitives"
import type { LucideIcon } from "../../typography"
import type { MessageActionDescriptor, MessageActionKey } from "../messageActions"

export interface MessageMenuModel {
  menuActions: ContextMenuAction[]
  confirmItems: PopoverMenuItem[]
  stopConfirmItems: PopoverMenuItem[]
}

export interface MessageMenuInput {
  descriptors: readonly MessageActionDescriptor[]
  labels: Record<MessageActionKey, string>
  icons: Record<MessageActionKey, LucideIcon>
  press: Record<MessageActionKey, () => void>
  confirm: {
    cancelLabel: string
    deleteLabel: string
    stopLabel: string
    onDelete: () => void
    onStop: () => void
  }
}

export function messageMenuModel({ descriptors, labels, icons, press, confirm }: MessageMenuInput): MessageMenuModel {
  return {
    menuActions: descriptors.map((d) => ({
      key: d.key,
      label: labels[d.key],
      icon: icons[d.key],
      destructive: d.destructive,
      onPress: press[d.key],
    })),
    confirmItems: [
      { key: "cancel", label: confirm.cancelLabel, onPress: () => {} },
      {
        key: "confirm-delete",
        label: confirm.deleteLabel,
        icon: "Trash2",
        destructive: true,
        onPress: confirm.onDelete,
      },
    ],
    stopConfirmItems: [
      { key: "cancel", label: confirm.cancelLabel, onPress: () => {} },
      {
        key: "confirm-stop",
        label: confirm.stopLabel,
        icon: "Lock",
        onPress: confirm.onStop,
      },
    ],
  }
}
