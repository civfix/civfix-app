/**
 * Platform selector: Metro resolves the MMKV `.native` seam and Next the cookie `.web` seam before this
 * file is consulted; platform-unaware tooling (tsc, plain Node) lands here and gets the web seam.
 */
export { sidebarStorage } from "./sidebarStorage.web"
