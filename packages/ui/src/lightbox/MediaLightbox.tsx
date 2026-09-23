/**
 * Seam selector: Metro resolves `./MediaLightbox` to the .native file and web bundlers to the .web file,
 * so only platform-unaware tooling (tsc, plain Node) reads this one. It imports the explicit `.web`
 * specifier because the bare one would resolve back into this module.
 */
export { MediaLightboxView } from "./MediaLightbox.web"
export type { MediaLightboxViewProps } from "./MediaLightbox.web"
