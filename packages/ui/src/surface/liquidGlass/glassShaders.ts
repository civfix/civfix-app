/**
 * SkSL source for the liquid-glass dock material. Native-only: it imports @shopify/react-native-skia at
 * module scope, so only `.native.tsx` seams may import it and web bundlers never resolve Skia.
 *
 * Skia's BackdropFilter cannot sample live RN views (the map), so each shape's frosted body is a real RN
 * view under the canvas. This shader draws only what those rects cannot: fill where the union covers but
 * no rect does (so it never double-darkens a rect), the ~1px border ring along the union, and the top
 * specular sheen. Geometry uniforms come from `morphUniforms`, colors from `parseRgba`.
 */
import { Skia, type SkRuntimeEffect } from "@shopify/react-native-skia"

const LIQUID_GLASS_SKSL = `
uniform vec4 leftBox;     // left shape rect: x, y, w, h (local pts)
uniform vec4 rightBox;    // right shape rect: x, y, w, h
uniform vec4 clearBox;    // trailing dismiss (X) circle rect (parked off-screen unless focused)
uniform float radius;     // constant corner radius (H/2), clamped per-shape below
uniform float k;          // smin blend distance (pinned tiny -> hard min union, no neck)
uniform float sheenCY;    // vertical center of the shapes (local pts, ~H/2)
uniform float sheenHalf;  // half-height of the shapes (local pts, ~H/2)
uniform vec4 tint;        // glass fill rgba (normalized) - the NECK cream
uniform vec4 borderColor; // ~1px edge ring rgba
uniform vec4 sheenColor;  // top sheen rgba

float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float smin(float a, float b, float kk) {
  float h = clamp(0.5 + 0.5 * (a - b) / kk, 0.0, 1.0);
  return mix(a, b, h) - kk * h * (1.0 - h);
}

// Signed distance to one rounded box, radius clamped to its half-extent so a square box reads circular.
float boxSdf(vec2 p, vec4 box) {
  vec2 b = box.zw * 0.5;
  vec2 c = box.xy + b;
  float r = min(radius, min(b.x, b.y));
  return sdRoundedBox(p - c, b, r);
}

// The dismiss circle is parked far off-screen while unfocused, so it contributes nothing there. k is
// pinned to MIN_K (a hard union, no neck), so at focus the gap keeps it a separate circle.
float sdf(vec2 p) {
  return smin(smin(boxSdf(p, leftBox), boxSdf(p, rightBox), k), boxSdf(p, clearBox), k);
}

// Finite-difference SDF gradient of the union.
vec2 gradient(vec2 p) {
  const float e = 0.5;
  float dx = sdf(p + vec2(e, 0.0)) - sdf(p - vec2(e, 0.0));
  float dy = sdf(p + vec2(0.0, e)) - sdf(p - vec2(0.0, e));
  return vec2(dx, dy) / (2.0 * e);
}

// "Pad" surface normal at signed distance sd: flat interior, curling up over the last "thickness" pts.
vec3 padNormal(float sd, vec2 g, float thickness) {
  float nCos = max(thickness + sd, 0.0) / thickness;
  float nSin = sqrt(max(1.0 - nCos * nCos, 0.0));
  return normalize(vec3(g.x * nCos, g.y * nCos, nSin) + vec3(0.0, 0.0, 1e-4));
}

vec4 material(vec2 p) {
  float d = sdf(p);
  if (d > 1.0) {
    return vec4(0.0);
  }
  vec2 g = gradient(p);
  vec3 n = padNormal(d, g, 10.0);
  vec2 gn = normalize(g + vec2(1e-4, 1e-4));

  // Coverage of the whole union vs. coverage of "inside a rect": the neck is union minus rects.
  float rectD = min(min(boxSdf(p, leftBox), boxSdf(p, rightBox)), boxSdf(p, clearBox));
  float unionCov = 1.0 - smoothstep(-0.75, 0.75, d);
  float rectCov = 1.0 - smoothstep(-0.75, 0.75, rectD);
  float neckCov = clamp(unionCov - rectCov, 0.0, 1.0);

  // Body cream ONLY in the neck (the RN rects supply the cream everywhere else).
  vec3 col = tint.rgb;
  float a = tint.a * neckCov;

  // Fresnel rim biased toward the lit (top-left) edge -> specular, over the whole union outline.
  float fresnel = pow(1.0 - abs(n.z), 3.0);
  float litness = clamp(-gn.y * 0.75 - gn.x * 0.25, 0.0, 1.0);
  float spec = fresnel * (0.3 + 0.7 * litness) * unionCov;
  col = mix(col, vec3(1.0), spec * 0.85);
  a = a + (1.0 - a) * spec * 0.6;

  // Top sheen: a soft band just inside upward-facing edges (the crisp edge highlight).
  float band = 1.0 - smoothstep(0.0, 6.0, -d);
  float sheen = band * clamp(-gn.y, 0.0, 1.0) * unionCov;
  col = mix(col, sheenColor.rgb, sheen * sheenColor.a * 0.55);

  // Interior top light: fades from the top edge to nothing by the vertical center, giving the flat RN
  // cream fill a "lit from above" depth. The canvas sits above the RN fill rects but below the icons and
  // text. vy: 0 at the shape's top edge, 1 at its bottom.
  float vy = clamp((p.y - (sheenCY - sheenHalf)) / (2.0 * sheenHalf), 0.0, 1.0);
  float topLight = clamp(1.0 - vy * 2.0, 0.0, 1.0);
  topLight = topLight * topLight;
  float interior = topLight * unionCov;
  col = mix(col, vec3(1.0), interior * 0.32);
  a = max(a, interior * 0.14);

  // ~1px hairline hugging the union's zero contour; the tight 0.75 feather keeps it a crisp system
  // hairline rather than a soft glow.
  float ring = (1.0 - smoothstep(0.0, 0.75, abs(d + 0.5))) * borderColor.a;
  col = mix(col, borderColor.rgb, ring);
  a = max(a, ring);

  return vec4(col * a, a); // premultiplied
}

vec4 main(vec2 fragCoord) {
  // 2x2 supersampling (budget <= 4 samples).
  const int samples = 2;
  float strength = 1.0 / float(samples * samples);
  vec4 color = vec4(0.0);
  for (int m = 0; m < samples; m++) {
    for (int nn = 0; nn < samples; nn++) {
      vec2 offset = vec2(float(m), float(nn)) / float(samples) - 0.5 / float(samples);
      color += material(fragCoord + offset) * strength;
    }
  }
  return color;
}
`

let cached: SkRuntimeEffect | null = null

export function makeLiquidGlassEffect(): SkRuntimeEffect {
  if (cached) return cached
  const effect = Skia.RuntimeEffect.Make(LIQUID_GLASS_SKSL)
  if (!effect) {
    throw new Error("liquidGlass: failed to compile the liquid-glass SkSL effect")
  }
  cached = effect
  return effect
}
