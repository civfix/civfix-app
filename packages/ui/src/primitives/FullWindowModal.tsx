import React from "react"
import { Modal, type ModalProps } from "react-native"
import { FullWindowInsets } from "../shell/systemNoticeFrameContext"

/** RN's Modal, whose content reads the device's real insets even when it opens from below the phone's notice. */
export function FullWindowModal({ children, ...props }: ModalProps) {
  return (
    <Modal {...props}>
      <FullWindowInsets>{children}</FullWindowInsets>
    </Modal>
  )
}
