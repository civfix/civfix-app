/**
 * The DOM element behind a react-native-web ref or event target. RN types a ref as the native component
 * instance, while on web it is the element itself. Null on native and in the static-export prerender,
 * which have no DOM.
 */
export function domElement(node: unknown): HTMLElement | null {
  return typeof HTMLElement !== "undefined" && node instanceof HTMLElement ? node : null
}
