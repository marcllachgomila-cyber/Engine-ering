import { BodyType, GearboxConfig, RealCarPreset } from "./types";
import { recommendedGearRatios } from "./gearRatios";
import { CAR_PRESET_DATA } from "./carData.generated";

// Picking a real car sets the engine and gearbox outright, plus everything
// in the chassis except the tyre/traction settings (tyre type, compound,
// pressure, wheel spin, traction control) - those stay driver-adjustable
// the same way they would on a real car. Gear ratios are re-derived from
// the recommended spread for the car's gear count rather than hand-modeled
// per car, matching how the custom-build gearbox step already works.
//
// Specs are representative approximations of each real car's engine and
// chassis layout (like BODY_TYPE_PRESETS elsewhere in this file) rather
// than exact manufacturer figures - some real-world values (drivetrain,
// gear count, weight) are nudged to fit within this simulator's supported
// ranges (fwd/rwd/awd, 5-8 speed gearboxes, per-body-type weight bounds).
//
// Every preset lives as its own JSON file under lib/physics/carData/ (see
// the RealCarPreset interface in types.ts for the shape), discovered
// automatically by scripts/generate-car-data.mjs into carData.generated.ts
// - the same "JSON files carry pure data, this file carries the prose"
// split lib/physics/circuits.ts already uses for circuitData/*.json. A
// car-specific rationale that doesn't fit here belongs in that car's own
// `notes` field instead.
//
// Every F1 season here runs the same 1.6L turbo V6 hybrid power unit and
// 8-speed seamless-shift gearbox mandated since 2014. Each preset's
// engine.displacementL etc. model the ICE half; engine.hybridBoostKw/
// hybridMaxTorqueNm add the MGU-K's electric half on top (see
// engineModel.ts) - 120kW was the regulated MGU-K output limit for the
// whole 2014-2025 era, jumping to 350kW for the 2026 rules' near-50/50
// ICE/electric split (MGU-H is dropped for 2026; see f1-2026.json's notes
// for specifics). Torque caps are representative, not exact regulation
// figures, same caveat as everywhere else in this file. What actually
// changes season to season otherwise: minimum weight crept up nearly
// every year as hybrid hardware got heavier, and the wheels jumped from
// 13" to 18" for the 2022 ground-effect rules. The real 405mm rear tyre
// width is nudged down to this simulator's 355mm ceiling.
//
// maxRevRpm is 15,000 for every season here - the FIA's hard PU rev limit
// has held constant at 15,000rpm across the entire 2014-2026 hybrid era
// (it isn't a per-season variable in reality, so it isn't one here).
// redlineRpm (where each engine's power curve is modeled as peaking) does
// vary: 2017-2021 steps up gradually season to season as fuel-flow
// efficiency and engine mapping matured (representative, not measured, like
// everything else here); 2022-2025 all share the same redline because the
// FIA froze ICE/turbo homologation from March 2022 through the end of 2025
// to redirect manufacturer effort at the 2026 rules - those four seasons
// really did run near-identical hardware, not just similar-looking specs.

export const REAL_CAR_PRESETS: Record<BodyType, RealCarPreset[]> = {
  minivan: [],
  suv: [],
  supercar: [],
  f1: [],
};

for (const car of CAR_PRESET_DATA) {
  REAL_CAR_PRESETS[car.category].push(car);
}

export function findRealCarPreset(id: string): RealCarPreset | undefined {
  for (const category of Object.values(REAL_CAR_PRESETS)) {
    const found = category.find((car) => car.id === id);
    if (found) return found;
  }
  return undefined;
}

export function gearboxFromPreset(preset: RealCarPreset): GearboxConfig {
  return {
    ...preset.gearbox,
    gearRatios: recommendedGearRatios(preset.gearbox.gearCount),
  };
}

export type { RealCarPreset };
