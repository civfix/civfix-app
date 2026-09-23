/**
 * Seam selector: Metro resolves `./appPromoStorage` to the .native file and web bundlers to the .web file,
 * so only platform-unaware tooling (tsc, vitest) reads this one, which re-exports the web seam.
 */
export { appPromoStorage } from "./appPromoStorage.web"
