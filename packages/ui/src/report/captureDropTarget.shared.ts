/**
 * Dropping a file is a desktop-browser idiom with no react-native gesture: RNW does not forward HTML drag
 * events through `View`, so the web seam attaches DOM listeners to the host node and native is a no-op.
 */

/** What a drop hands back. Deliberately `unknown`: a DOM `File` never crosses into shared source. */
export type DroppedItem = unknown

export interface CaptureDropTarget {
  /** Receives the host DOM node on web and the ignored `View` on native; `unknown` names neither type. */
  ref: (node: unknown) => void
  /** Drives the coral ring. Always false on native. */
  dragging: boolean
  /**
   * False on native, while the caller disabled it, and on a host that cannot turn a dropped file into media.
   * It gates the caption, so the copy never promises an affordance that is not wired.
   */
  active: boolean
}

/**
 * The web camera seam's `image/*,video/*` set, stated once so the drag feedback and the drop agree: a drag
 * the card would refuse never lights the ring. An empty type is accepted because some browsers report `""`
 * for a file the OS has no MIME mapping for, which includes ordinary photos.
 */
export function isDroppableType(type: string | null | undefined): boolean {
  if (!type) return true
  return type.startsWith("image/") || type.startsWith("video/")
}
