import { EngineConfig, EngineLayout } from "./types";

// A Wankel engine reuses EngineConfig's `cylinders` field as its rotor count,
// so anything that reads `cylinders` should go through these helpers when the
// distinction matters (labels, firing rate, mass).
export function isRotary(engine: Pick<EngineConfig, "layout">): boolean {
  return engine.layout === "rotary";
}

export const ROTOR_OPTIONS = [1, 2, 3, 4];
// Per-rotor chamber volume range. Mazda's rotaries sit at 573cc (12A) to
// 654cc (13B/20B/R26B) - the slider allows a bit either side of that.
export const ROTARY_MIN_L_PER_ROTOR = 0.4;
export const ROTARY_MAX_L_PER_ROTOR = 0.8;

// Power strokes per output-shaft revolution. A four-stroke cylinder fires
// once every two crank turns; each Wankel rotor fires once per eccentric
// shaft turn (three faces, rotor turning at 1/3 shaft speed).
export function firingEventsPerRev(engine: Pick<EngineConfig, "layout" | "cylinders">): number {
  return isRotary(engine) ? engine.cylinders : engine.cylinders / 2;
}

const LAYOUT_NAMES: Record<EngineLayout, string> = {
  inline: "inline",
  v: "V",
  flat: "flat",
  w: "W",
  rotary: "rotary",
};

// "4-cyl inline" / "2-rotor rotary" - the one place engine size gets
// spelled out for display, so rotors never show up as "cylinders".
export function engineSizeLabel(engine: Pick<EngineConfig, "layout" | "cylinders">): string {
  if (isRotary(engine)) return `${engine.cylinders}-rotor rotary`;
  return `${engine.cylinders}-cyl ${LAYOUT_NAMES[engine.layout]}`;
}
