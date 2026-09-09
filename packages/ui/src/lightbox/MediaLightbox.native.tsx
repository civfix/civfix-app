/**
 * MediaLightbox (native seam) - the full-screen media viewer on native (Metro).
 *
 * The viewer itself lives in the shared <MediaLightboxBase>; this seam only supplies the native Modal
 * delta (`presentationStyle="overFullScreen"`, so the transparent modal floats over the current screen).
 * No keyboard listeners on native; the RN Modal routes the Android hardware-back through onRequestClose.
 */
import React from "react"
import { MediaLightboxBase } from "./MediaLightboxBase"
import type { MediaLightboxViewProps } from "./MediaLightboxBase"

export type { MediaLightboxViewProps }

export function MediaLightboxView(props: MediaLightboxViewProps) {
  return <MediaLightboxBase {...props} modalProps={{ presentationStyle: "overFullScreen" }} />
}
