export type ComposerAttachRowKey = "photo" | "camera" | "poll"

export interface ComposerAttachRowsInput {
  isWeb: boolean
  canCreatePoll: boolean
}

export function composerAttachRows(input: ComposerAttachRowsInput): ComposerAttachRowKey[] {
  const rows: ComposerAttachRowKey[] = ["photo"]
  // Native only: the web camera capability is the same file input as the library pick.
  if (!input.isWeb) rows.push("camera")
  if (input.canCreatePoll) rows.push("poll")
  return rows
}
