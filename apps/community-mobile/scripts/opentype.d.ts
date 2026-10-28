// gen-splash.mjs installs opentype.js on demand (--no-save), so it ships no types here; these are the
// parts the script calls.
declare module "opentype.js" {
  interface Path {
    fill: string | null
    toSVG(decimalPlaces?: number): string
  }
  interface Glyph {
    advanceWidth: number
    getPath(x: number, y: number, fontSize: number): Path
  }
  interface Font {
    unitsPerEm: number
    charToGlyph(char: string): Glyph
  }
  // CommonJS only: an ES import gets module.exports as the default export.
  const opentype: { parse(buffer: ArrayBufferLike): Font }
  export default opentype
}
