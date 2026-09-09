/**
 * The shared half of the capture step's FILE-DROP target: the contract both platform seams satisfy, and
 * the one pure predicate they share.
 *
 * WHY A SEAM AT ALL. Dragging a photo onto a surface is a pointer idiom - it exists on a desktop browser
 * and nowhere else this app runs. There is no react-native gesture for it (RNW does not forward the HTML
 * drag events through `View`, so the web seam attaches real DOM listeners to the host node), and a phone
 * has no drag source. So the hook resolves to a no-op on native, `active` reads false, and the wizard's
 * "or drag photos here" caption never renders there - the capture card stays byte-identical.
 */

/** What a drop hands back. Deliberately `unknown`: a DOM `File` never crosses into shared source. */
export type DroppedItem = unknown

export interface CaptureDropTarget {
  /**
   * Attach to the surface that accepts the drop. On web (RNW) this receives the host DOM node; on native
   * it receives the `View` instance and is ignored. Typed `unknown` so neither platform's node type has to
   * be named here.
   */
  ref: (node: unknown) => void
  /** Is an acceptable drag hovering the surface right now? Drives the coral ring. Always false on native. */
  dragging: boolean
  /**
   * Does this surface actually accept drops? False on native, false while the caller disabled it, and
   * false on a host that cannot turn a dropped file into media. It gates the CAPTION, so the copy can
   * never promise an affordance that is not wired.
   */
  active: boolean
}

/**
 * Is this MIME type something the report wizard can carry? The same `image/*,video/*` set the web camera
 * seam puts on its file input, stated once so the drag feedback and the drop agree: a drag the card would
 * refuse never lights the ring in the first place (no ring = not droppable is the honest answer, and it
 * costs no error copy).
 *
 * An EMPTY type is accepted: some browsers report `""` for a file the OS has no MIME mapping for, and
 * refusing those would reject ordinary photos on the strength of a missing registry entry.
 */
export function isDroppableType(type: string | null | undefined): boolean {
  if (!type) return true
  return type.startsWith("image/") || type.startsWith("video/")
}
