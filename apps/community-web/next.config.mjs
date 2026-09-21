import { execSync } from "node:child_process"
import { createRequire } from "node:module"
import { existsSync, realpathSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)

/**
 * Dedupe every runtime singleton that @civfix/ui could otherwise resolve from a second physical copy.
 *
 * @civfix/ui is a workspace package whose source webpack resolves to its REAL path (packages/ui/src),
 * so module resolution from there walks packages/ui/node_modules before the hoisted root store. Any
 * package that pnpm could not hoist (a version conflict) would then load twice: two safe-area-contexts
 * hand the shared shell a zero inset, two react-native-webs register two StyleSheet pools. Aliasing
 * each bare specifier to the app's single resolved directory collapses them onto one instance.
 *
 * react/react-dom are deliberately ABSENT: Next already aliases those (to its own vendored copies, per
 * build layer AND per `react-server` condition), so the ui source shares the app's React for free -
 * while an alias of ours would CLOBBER Next's, hand the RSC prerender the client build of React, and
 * fail the export with "Cannot read properties of null (reading 'useRef')". lucide-react-native is
 * deliberately ABSENT: it is stateless icon source, and its `/icons` subpath is only reachable through
 * its exports map, which a directory alias would bypass.
 *
 * Packages are located on disk (app node_modules first, then the hoisted workspace store) rather than
 * through `require.resolve(name + "/package.json")` because several RN packages do not expose
 * ./package.json through their exports map.
 */
const packageSearchRoots = [
  new URL("./node_modules/", import.meta.url),
  new URL("../../node_modules/", import.meta.url),
]
const appPackageDir = (name) => {
  for (const root of packageSearchRoots) {
    const candidate = fileURLToPath(new URL(`${name}/`, root))
    if (existsSync(candidate)) return realpathSync(candidate)
  }
  return dirname(realpathSync(require.resolve(`${name}/package.json`)))
}

const reactNativeWebDir = appPackageDir("react-native-web")

const dedupedSingletons = Object.fromEntries(
  [
    "react-native-safe-area-context",
    "react-native-gesture-handler",
    "react-native-reanimated",
    "react-native-svg",
    "@gorhom/bottom-sheet",
    "zustand",
  ].map((name) => [`${name}$`, appPackageDir(name)]),
)

/**
 * Force a SINGLE @tanstack/react-query instance across the app AND the @civfix/ui source: with two
 * physical copies, the app's <QueryClientProvider> and the shared data hooks' useQueryClient read
 * DIFFERENT React contexts, so the hooks throw "No QueryClient set" even though a provider is mounted.
 */
const reactQueryDir = dirname(require.resolve("@tanstack/react-query/package.json"))

/**
 * Force a SINGLE maplibre-gl instance across the app AND the @civfix/ui Map.web seam: maplibre-gl
 * keeps MODULE-LEVEL singletons (notably the shared Web Worker pool that parses the style + tiles).
 * With two copies the style never finishes loading and the basemap stays blank.
 */
const maplibreGlDir = dirname(require.resolve("maplibre-gl/package.json"))

const sharedContractDir = dirname(require.resolve("@civfix/shared/package.json"))

function resolveCommitSha() {
  const fromCi = process.env.GITHUB_SHA
  if (fromCi) return fromCi
  try {
    return execSync("git rev-parse HEAD", {
      cwd: dirname(fileURLToPath(import.meta.url)),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
  } catch {
    return ""
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static SPA export: emits the shell + JS into ./out with no server runtime.
  output: "export",
  reactStrictMode: true,
  // Required for output: "export" (no Image Optimization server).
  images: {
    unoptimized: true,
  },
  // Trailing slashes make the static export host cleanly on static file servers
  // (each route becomes a directory with an index.html).
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_COMMIT_SHA: resolveCommitSha(),
  },
  // @civfix/shared ships ESM + CJS (built dist) and @civfix/ui ships untranspiled .tsx SOURCE, both
  // as workspace packages, so Next must transpile both plus the React-Native stack
  // (react-native-web renders RN primitives on web).
  transpilePackages: [
    "@civfix/shared",
    "@civfix/ui",
    "lucide-react-native",
    "react-native",
    "react-native-web",
    "react-native-reanimated",
    "react-native-svg",
    "react-native-gesture-handler",
    "react-native-safe-area-context",
    "@gorhom/bottom-sheet",
  ],
  webpack: (config) => {
    // Alias bare "react-native" imports to react-native-web so the shared @civfix/ui
    // source (authored in RN primitives) resolves to the web implementation.
    config.resolve.alias = {
      ...config.resolve.alias,
      ...dedupedSingletons,
      "react-native-web": reactNativeWebDir,
      // EXACT-match the bare "react-native" specifier -> react-native-web (the common case, authored
      // RN primitives in @civfix/ui).
      "react-native$": reactNativeWebDir,
      // NON-exact fallback for deep "react-native/Libraries/..." SUBPATH imports. The `$` rule above is
      // exact-match only, so without this any deep RN subpath (pulled in transitively by the map stack
      // or other RN deps) would try to resolve into the real react-native package and fail to bundle on
      // web ("Module not found: react-native/Libraries/..."). Aliasing the bare prefix collapses those
      // subpaths onto react-native-web too. MUST come AFTER the `$` rule so the exact case wins first.
      "react-native": reactNativeWebDir,
      // Single @tanstack/react-query instance (app + @civfix/ui share one QueryClient context).
      "@tanstack/react-query$": reactQueryDir,
      // Single maplibre-gl instance (app + @civfix/ui Map.web share one worker pool, so the
      // style loads). See the maplibreGlDir note above.
      "maplibre-gl$": maplibreGlDir,
      "@civfix/shared$": sharedContractDir,
      "@civfix/shared/client$": sharedContractDir,
    }
    // Prefer platform-specific .web.* files when @civfix/ui ships .web/.native seams.
    config.resolve.extensions = [
      ".web.tsx",
      ".web.ts",
      ".web.jsx",
      ".web.js",
      ...config.resolve.extensions,
    ]
    return config
  },
}

export default nextConfig
