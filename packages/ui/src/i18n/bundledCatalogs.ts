// Metro and Next resolve the .native/.web seam first; this selector serves tooling without platform
// resolution (tsc, plain Node) and re-exports the web seam so it gets concrete types.
export { initialResources, loadCatalog } from "./bundledCatalogs.web"
