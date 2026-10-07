// `overFullScreen` lets the transparent modal float over the current screen. The RN Modal routes the
// Android hardware back through onRequestClose, so native needs no key listeners.
import React from "react"
import { MediaLightboxBase } from "./MediaLightboxBase"
import type { MediaLightboxViewProps } from "./MediaLightboxBase"

export type { MediaLightboxViewProps }

export function MediaLightboxView(props: MediaLightboxViewProps) {
  return <MediaLightboxBase {...props} modalProps={{ presentationStyle: "overFullScreen" }} />
}
