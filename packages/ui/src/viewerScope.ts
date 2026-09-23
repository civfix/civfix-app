import { create } from "zustand"

/**
 * One hook-up point between a host's auth layer and every store that holds what a viewer typed or picked
 * (post, reply, report and event drafts: text, precise locations, photos, finalized upload ids). On a
 * shared device none of that may reach the next account, so each such store registers here and the hosts
 * call `adoptViewer` on every identity change and `discardViewerDrafts` on a confirmed sign-out.
 *
 * Semantics:
 *   - a confirmed viewer loss (sign-out, a 401 teardown, a live "not signed in") wipes every draft;
 *   - a different signed-in account wipes every draft that the previous account owned;
 *   - a transient null viewer (a session check with no answer, an unreadable Keychain) keeps them, so a
 *     network blip never costs an author their work (the post composer also hides its draft meanwhile);
 *   - a guest who signs in keeps what they started as a guest (a report begun signed out resumes).
 */
export interface ViewerScopedDrafts {
  /** Wipe everything the store holds for the viewer. */
  discard: () => void
  /** Told about every viewer change, transient nulls included, for a store that scopes its own view. */
  onViewer?: (viewerId: string | null) => void
}

const registry = new Map<object, ViewerScopedDrafts>()

let currentViewerId: string | null = null
/** The signed-in account the drafts belong to; null while they are a guest's. */
let draftOwnerId: string | null = null

/**
 * Bumped whenever the drafts are wiped. Components that mirror a draft into local state (an attachment
 * list, carried thumbnails) key on it so the previous author's local copy cannot be written back.
 */
const useDraftGenerationStore = create<{ generation: number }>(() => ({ generation: 0 }))

export function useViewerDraftGeneration(): number {
  return useDraftGenerationStore((state) => state.generation)
}

export function viewerDraftGeneration(): number {
  return useDraftGenerationStore.getState().generation
}

/** Called once by each draft store module, with the store object itself as the key. */
export function registerViewerScopedDrafts(store: object, scope: ViewerScopedDrafts): void {
  registry.set(store, scope)
  scope.onViewer?.(currentViewerId)
}

export function isViewerScopedDraftStore(store: object): boolean {
  return registry.has(store)
}

function wipeAll(): void {
  for (const scope of registry.values()) scope.discard()
  useDraftGenerationStore.setState((state) => ({ generation: state.generation + 1 }))
}

/** The host's auth layer reports the current viewer (null when signed out) on every identity change. */
export function adoptViewer(viewerId: string | null): void {
  if (viewerId === currentViewerId) return
  currentViewerId = viewerId
  for (const scope of registry.values()) scope.onViewer?.(viewerId)
  if (viewerId === null) return
  if (draftOwnerId !== null && draftOwnerId !== viewerId) wipeAll()
  draftOwnerId = viewerId
}

/** A confirmed viewer loss: sign-out, a 401 that ended the session, a live "not signed in" answer. */
export function discardViewerDrafts(): void {
  wipeAll()
  draftOwnerId = null
}
