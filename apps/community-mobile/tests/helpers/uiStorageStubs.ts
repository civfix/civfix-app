// "@civfix/ui" for a Node test of local-data clearing: the viewer-scope stubs the auth store needs, and the
// real native persistent storage (react-native-mmkv stubbed by mmkvStub.ts).
import { calls } from "./nativeStubs.ts"
import { mmkvFile } from "./mmkvStub.ts"
import { MAP_FILTERS_STORAGE_ID } from "../../../../packages/ui/src/storage/storageIds.ts"

export { adoptViewer, discardViewerDrafts } from "./nativeStubs.ts"

export const RESET_FILTERS_VALUE = '{"state":{"reset":true},"version":1}'

// The real reset sets each @civfix/ui store back to its initial values, which persist writes through; this
// stand-in makes that write, so a clear that runs before it leaves it behind.
export function resetPersistedStores(): void {
  calls.push("resetPersistedStores")
  mmkvFile(MAP_FILTERS_STORAGE_ID).set("civfix.map-filters", RESET_FILTERS_VALUE)
}
export {
  clearPersistentStorage,
  persistentStorage,
} from "../../../../packages/ui/src/storage/persistentStorage.native.ts"
