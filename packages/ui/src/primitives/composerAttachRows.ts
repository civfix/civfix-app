/**
 * composerAttachRows (P6 Task 6.5) - the PURE row-model for the composer's "+" attach sheet. The
 * ComposerAttachSheet renders whatever keys this returns; this module owns only the WHICH-ROWS-SHOW
 * matrix so it unit-tests without React (package convention: pure-logic vitest).
 *
 * It lives beside its ONLY consumer, the ComposerAttachSheet primitive: a primitive may not import from
 * bodies/ (bodies import the primitives barrel, so the reverse invites a cycle), and this pure matrix has
 * no business being a body in the first place.
 *
 * Rows, in display order:
 *   - photo:  ALWAYS present (the existing library pick - useComposerAttachments.onAttach).
 *   - camera: NATIVE only (hidden on web - the web camera capability is a file-input that duplicates
 *             the library pick, so a distinct "Camera" row there is noise). Uses CameraCapability.capture.
 *   - poll:   only when `canCreatePoll` - the composer's send-permission mirror (roomKind !== "dm" and
 *             the viewer can actually post here). A dm room / channel read-only slot yields false.
 */

/** The attach-sheet row keys this phase produces, in display order. */
export type ComposerAttachRowKey = "photo" | "camera" | "poll"

export interface ComposerAttachRowsInput {
  /** Platform.OS === "web" - hides the Camera row (web camera == the library pick). */
  isWeb: boolean
  /** The viewer may create a poll in this room (roomKind !== "dm" and can send) - gates the Poll row. */
  canCreatePoll: boolean
}

/** Assemble the attach-sheet rows for the current platform + room, in display order. */
export function composerAttachRows(input: ComposerAttachRowsInput): ComposerAttachRowKey[] {
  const rows: ComposerAttachRowKey[] = ["photo"]
  // Camera is a native-only affordance: on web the capability's file-input duplicates the library pick.
  if (!input.isWeb) rows.push("camera")
  if (input.canCreatePoll) rows.push("poll")
  return rows
}
