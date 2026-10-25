// "@civfix/ui" for a Node test of local-data clearing: the viewer-scope stubs the auth store needs, and the
// real native persistent storage (react-native-mmkv stubbed by mmkvStub.ts).
export { adoptViewer, discardViewerDrafts } from "./nativeStubs.ts"
export {
  clearPersistentStorage,
  persistentStorage,
} from "../../../../packages/ui/src/storage/persistentStorage.native.ts"
