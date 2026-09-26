import { EngineCurves, RoadCondition, TyreCompound, TyreType, VehicleSpec } from "./types";

export const AIR_DENSITY_KG_M3 = 1.225;
export const G = 9.81;

// Reference road-condition grip, as if riding on a "standard" tyre in the
// "medium" compound - every other tyre type/compound combination scales
// this baseline up or down below. A road tyre's dry mu is ~1.0-1.1 (see
// ROAD_TYRE_MU in vehicleModel.ts); on a wet road it's ~0.6.
export function conditionGripMultiplier(condition: RoadCondition): number {
  switch (condition) {
    case "dry":
      return 1.0;
    case "wind":
      return 1.0;
    case "wet":
      return 0.6;
    case "rain":
      return 0.5;
  }
}

// Slicks (no tread, like an F1 dry tyre) put more rubber on tarmac and grip
// harder in the dry - mu ~1.5 against a road tyre's ~1.15 - but with nowhere
// for water to escape they're treacherous as soon as the road is wet.
// Standard (treaded/road) tyres are the more even, all-weather choice this
// baseline is built around.
export const TYRE_TYPE_GRIP_FACTOR: Record<TyreType, Record<RoadCondition, number>> = {
  slick: { dry: 1.3, wind: 1.3, wet: 0.55, rain: 0.45 },
  standard: { dry: 1.0, wind: 1.0, wet: 1.0, rain: 1.0 },
};

// Compound mirrors F1's lineup: soft/medium/hard are the dry-weather slick
// range (soft grips hardest but is the most compromised once it's wet;
// hard is the most conservative), while intermediate and wet are the
// grooved rain compounds, which sacrifice outright dry grip for the ability
// to clear water and stay planted once the track is damp or soaked.
export const TYRE_COMPOUND_GRIP_FACTOR: Record<TyreCompound, Record<RoadCondition, number>> = {
  soft: { dry: 1.08, wind: 1.08, wet: 0.85, rain: 0.8 },
  medium: { dry: 1.0, wind: 1.0, wet: 1.0, rain: 1.0 },
  hard: { dry: 0.94, wind: 0.94, wet: 0.9, rain: 0.92 },
  intermediate: { dry: 0.8, wind: 0.8, wet: 1.25, rain: 1.35 },
  wet: { dry: 0.68, wind: 0.68, wet: 1.15, rain: 1.55 },
};

// Combines the road condition with how well the chosen tyre type and
// compound suit that condition. Defaults to "standard" + "medium", which
// reproduces the plain conditionGripMultiplier baseline exactly.
export function tyreGripMultiplier(
  tyreType: TyreType,
  tyreCompound: TyreCompound,
  condition: RoadCondition,
): number {
  return (
    conditionGripMultiplier(condition) *
    TYRE_TYPE_GRIP_FACTOR[tyreType][condition] *
    TYRE_COMPOUND_GRIP_FACTOR[tyreCompound][condition]
  );
}

// The "wind" condition is a steady headwind straight off the nose, which
// only ever adds to the relative airspeed (and therefore drag) - it never
// helps.
export function conditionHeadwindMs(condition: RoadCondition): number {
  return condition === "wind" ? 12 : 0;
}

export function rpmFromSpeed(
  speedMs: number,
  gearRatio: number,
  vehicle: VehicleSpec,
): number {
  return (
    (speedMs / vehicle.wheelRadiusM) *
    gearRatio *
    vehicle.finalDrive *
    (60 / (2 * Math.PI))
  );
}

// Picks the gear a driver would actually be in at a given road speed: the
// highest (tallest) gear that still keeps the engine above idle. Used to
// downshift the transmission as the car slows during braking, the same way
// it upshifts as it speeds up under power.
export function gearForSpeed(speedMs: number, vehicle: VehicleSpec, curves: EngineCurves): number {
  for (let g = vehicle.gearRatios.length; g >= 1; g--) {
    if (rpmFromSpeed(speedMs, vehicle.gearRatios[g - 1], vehicle) >= curves.idleRpm) {
      return g;
    }
  }
  return 1;
}

// Picks the gear a driver accelerating hard would actually be in: the
// lowest (shortest) gear that doesn't over-rev past the shift point - the
// same gear the tallest-torque-multiplication straight-line tests end up
// in as they progressively upshift from a standing start. Unlike
// `gearForSpeed` (a cruising/coasting heuristic), this never leaves the car
// short-shifted into a tall gear it wouldn't actually be using under power.
export function gearForAcceleration(speedMs: number, vehicle: VehicleSpec): number {
  for (let g = 1; g < vehicle.gearRatios.length; g++) {
    if (rpmFromSpeed(speedMs, vehicle.gearRatios[g - 1], vehicle) <= vehicle.shiftRpm) {
      return g;
    }
  }
  return vehicle.gearRatios.length;
}

// Force at the driven wheels: F = T * gear * final drive * eta / r_tyre.
export function wheelForceN(torqueNm: number, gearRatio: number, vehicle: VehicleSpec): number {
  return (torqueNm * gearRatio * vehicle.finalDrive * vehicle.drivetrainEfficiency) / vehicle.wheelRadiusM;
}

// Everything that spins with the wheels (engine, flywheel, gearbox,
// driveshafts, wheels) has to be spun up along with the car, which acts
// like extra mass: a = F / (m * k). Engine-side inertia seen at the wheels
// grows with the square of the gear ratio, so k is largest in first (~1.3)
// and smallest in top (~1.05).
const ROTATING_INERTIA_TOP_GEAR = 1.05;
const ROTATING_INERTIA_FIRST_GEAR = 1.3;

export function rotatingInertiaFactor(vehicle: VehicleSpec, gear: number): number {
  const ratios = vehicle.gearRatios;
  const first = ratios[0];
  const top = ratios[ratios.length - 1];
  const ratio = ratios[Math.min(Math.max(gear, 1), ratios.length) - 1];
  const t = first > top ? (ratio * ratio - top * top) / (first * first - top * top) : 0;
  return (
    ROTATING_INERTIA_TOP_GEAR +
    (ROTATING_INERTIA_FIRST_GEAR - ROTATING_INERTIA_TOP_GEAR) * Math.min(1, Math.max(0, t))
  );
}

// Top speed is whichever limit comes first:
//   drag-limited - where wheel power only just covers drag + rolling
//                  resistance, P_wheel = (F_drag + F_roll) * v
//   gear-limited - where the engine hits its rev limit in the tallest gear,
//                  v = rpm_max * 2pi * r / (60 * gear * final drive)
// Every gear is checked, since a tall overdrive top gear can have too
// little force to pull the speed the gear below it reaches. Torque vs RPM
// isn't monotonic either, so the whole range is scanned for the highest
// speed that still balances rather than stopping at the first shortfall.
export function estimateTopSpeedKph(
  curves: EngineCurves,
  vehicle: VehicleSpec,
  headwindMs: number,
): number {
  const rollingForce = vehicle.rollingResistanceCoefficient * vehicle.weightKg * G;

  let lastValidSpeedMs = 0;
  const stepMs = 0.2;
  for (let speedMs = stepMs; speedMs < 170; speedMs += stepMs) {
    const relativeSpeedMs = speedMs + headwindMs;
    const resistance =
      0.5 *
        AIR_DENSITY_KG_M3 *
        vehicle.dragCoefficient *
        vehicle.frontalAreaM2 *
        relativeSpeedMs *
        relativeSpeedMs +
      rollingForce;

    let bestDriveForce = 0;
    for (const ratio of vehicle.gearRatios) {
      const rpm = rpmFromSpeed(speedMs, ratio, vehicle);
      if (rpm > curves.maxRevRpm || rpm < curves.idleRpm) continue;
      bestDriveForce = Math.max(bestDriveForce, wheelForceN(curves.torqueAt(rpm), ratio, vehicle));
    }

    if (bestDriveForce > resistance) lastValidSpeedMs = speedMs;
  }

  return lastValidSpeedMs * 3.6;
}

// Drag-limited top speed from peak wheel power alone, ignoring gearing -
// solves P_wheel = (F_drag + F_roll) * v by bisection. Used to pick a
// final drive that lets the car actually reach it.
export function dragLimitedTopSpeedMs(
  peakWheelPowerW: number,
  dragAreaM2: number,
  rollingForceN: number,
): number {
  const resistancePower = (v: number) =>
    (0.5 * AIR_DENSITY_KG_M3 * dragAreaM2 * v * v + rollingForceN) * v;
  let lo = 0;
  let hi = 200;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (resistancePower(mid) < peakWheelPowerW) lo = mid;
    else hi = mid;
  }
  return lo;
}
