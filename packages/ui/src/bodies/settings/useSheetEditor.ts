import { useState, type Dispatch, type SetStateAction } from "react"

export interface SheetEditorSetters {
  setEditing: (editing: boolean) => void
  setSubmitError: (message: string | null) => void
}

export function sheetCommit<V>(
  save: (value: V) => Promise<void>,
  mapError: (err: unknown) => string,
  { setEditing, setSubmitError }: SheetEditorSetters,
): (value: V) => void {
  return (value) => {
    setSubmitError(null)
    void save(value)
      .then(() => setEditing(false))
      .catch((err: unknown) => setSubmitError(mapError(err)))
  }
}

export interface SheetEditor<D, V> {
  editing: boolean
  draft: D
  setDraft: Dispatch<SetStateAction<D>>
  submitError: string | null
  setSubmitError: (message: string | null) => void
  begin: () => void
  cancel: () => void
  commit: (value: V) => void
}

export interface SheetEditorOptions<D, V> {
  initial: D
  save: (value: V) => Promise<void>
  mapError: (err: unknown) => string
}

export function useSheetEditor<D, V>({
  initial,
  save,
  mapError,
}: SheetEditorOptions<D, V>): SheetEditor<D, V> {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<D>(initial)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const begin = () => {
    setDraft(initial)
    setSubmitError(null)
    setEditing(true)
  }
  const cancel = () => {
    setSubmitError(null)
    setEditing(false)
  }
  const commit = sheetCommit(save, mapError, { setEditing, setSubmitError })

  return { editing, draft, setDraft, submitError, setSubmitError, begin, cancel, commit }
}
