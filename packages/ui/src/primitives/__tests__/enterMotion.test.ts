import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const code = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

describe("SuccessCheck draw", () => {
  const source = code("../SuccessCheck.tsx")

  it("animates the check's dash offset as a prop, never through per-frame React state", () => {
    expect(source).toContain("const AnimatedPath = Animated.createAnimatedComponent(Path)")
    expect(source).toMatch(/draw\.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[CHECK_LENGTH, 0\] \}\)/)
    expect(source).toContain("strokeDashoffset={dashOffset}")
    expect(source).not.toMatch(/addListener|useState/)
  })
})

describe("BrandAboutCard entrance", () => {
  const source = code("../BrandAboutCard.tsx")

  it("runs on the native driver off web, and lands at rest at once under reduced motion", () => {
    expect(source).toContain('useNativeDriver: Platform.OS !== "web"')
    expect(source).not.toContain("useNativeDriver: false")
    expect(source).toMatch(/if \(reducedMotion\) \{\n\s+progress\.setValue\(1\)\n\s+return\n\s+\}/)
  })
})
