// The flow visualisations' colour scale: local speed relative to the
// freestream, on a diverging scale around 1.0 (validated against the panel
// surface with the dataviz palette checker) - slower flow toward blue,
// faster toward the brand amber, freestream a neutral grey. Shared by the
// 2D tunnel and the 3D flow view so the two read identically.

export const SLOW_RGB = [0x4c, 0x8d, 0xf6];
export const NEUTRAL_RGB = [0x85, 0x82, 0x7a];
export const FAST_RGB = [0xf5, 0xa0, 0x00];
// Speed ratios that map to the two poles.
export const SLOW_POLE = 0.4;
export const FAST_POLE = 1.6;

const STEPS = 64;

function mix(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

// Precomputed lookup over speed ratios SLOW_POLE..FAST_POLE, as 0-255 RGB.
const LUT = Array.from({ length: STEPS }, (_, i) => {
  const s = SLOW_POLE + ((FAST_POLE - SLOW_POLE) * i) / (STEPS - 1);
  return s < 1 ? mix(NEUTRAL_RGB, SLOW_RGB, (1 - s) / (1 - SLOW_POLE)) : mix(NEUTRAL_RGB, FAST_RGB, (s - 1) / (FAST_POLE - 1));
});
const LUT_CSS = LUT.map((c) => `rgb(${c[0]},${c[1]},${c[2]})`);

function index(speed: number): number {
  const t = (speed - SLOW_POLE) / (FAST_POLE - SLOW_POLE);
  return Math.max(0, Math.min(STEPS - 1, Math.round(t * (STEPS - 1))));
}

export function speedColorCss(speed: number): string {
  return LUT_CSS[index(speed)];
}

// 0-255 RGB triple.
export function speedColorRgb(speed: number): number[] {
  return LUT[index(speed)];
}

const css = (c: number[]) => `rgb(${c.join(",")})`;
export const SPEED_LEGEND_GRADIENT = `linear-gradient(to right, ${css(SLOW_RGB)}, ${css(NEUTRAL_RGB)}, ${css(FAST_RGB)})`;
