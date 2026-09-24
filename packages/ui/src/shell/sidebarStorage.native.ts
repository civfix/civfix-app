import { persistentStorage } from "../storage/persistentStorage"
import { SIDEBAR_STORAGE_ID } from "../storage/storageIds"

export const sidebarStorage = persistentStorage(SIDEBAR_STORAGE_ID)
