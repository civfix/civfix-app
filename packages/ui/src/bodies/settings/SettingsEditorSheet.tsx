import React from "react"
import type { IconName } from "../../typography"
import { ModalCardSheet, PrimaryButton, SecondaryButton, SettingsRow } from "../../primitives"
import type { SheetEditor } from "./useSheetEditor"

export interface SettingsEditorSheetProps<D, V> {
  editor: SheetEditor<D, V>
  icon: IconName
  label: string
  sub: string
  dismissLabel: string
  cancelLabel: string
  saveLabel: string
  saving: boolean | undefined
  canSave: boolean
  onCommit: () => void
  children: React.ReactNode
}

export function SettingsEditorSheet<D, V>({
  editor,
  icon,
  label,
  sub,
  dismissLabel,
  cancelLabel,
  saveLabel,
  saving,
  canSave,
  onCommit,
  children,
}: SettingsEditorSheetProps<D, V>) {
  return (
    <>
      <SettingsRow icon={icon} label={label} sub={sub} onPress={editor.begin} />
      <ModalCardSheet
        visible={editor.editing}
        onClose={editor.cancel}
        onCommit={onCommit}
        headerIcon={icon}
        title={label}
        dismissLabel={dismissLabel}
        error={editor.submitError}
        actions={
          <>
            <SecondaryButton label={cancelLabel} onPress={editor.cancel} size="sm" />
            <PrimaryButton
              label={saveLabel}
              onPress={onCommit}
              loading={saving}
              disabled={!canSave}
            />
          </>
        }
      >
        {children}
      </ModalCardSheet>
    </>
  )
}
