import { EngineCurves, RoadCondition, TyreCompound, TyreType, VehicleSpec } from "./types";

export const AIR_DENSITY_KG_M3 = 1.225;
export const G = 9.81;

// Wheel spin is modeled as a slip window: a little intentional slip (around
// the recommended 10%) actually uses the tire's peak grip, while too little
// or too much both waste it - launching too clean under-uses the tire, and
// spinning too much just burns rubber instead of moving the car.
export function wheelSpinEfficiency(wheelSpinPercent: number): number {
  const optimal = 10;
  const distance = Math.abs(wheelSpinPercent - optimal);
  return Math.max(0.55, 1 - distance / 100);
}

// Reference road-condition grip, as if riding on a "standard" tyre in the
// "medium" compound - every other tyre type/compound combination scales
// this baseline up or down below.
export function conditionGripMultiplier(condition: RoadCondition): number {
  switch (condition) {
    case "dry":
      return 1.0;
    case "wind":
      return 1.0;
    case "wet":
      return 0.75;
    case "rain":
      return 0.55;
  }
}

// Slicks (no tread, like an F1 dry tyre) put more rubber on tarmac and grip
// harder in the dry, but with nowhere for water to escape they're treacherous
// as soon as the road is wet. Standard (treaded/road) tyres are the more
// even, all-weather choice this baseline is built around.
export const TYRE_TYPE_GRIP_FACTOR: Record<TyreType, Record<RoadCondition, number>> = {
  slick: { dry: 1.1, wind: 1.1, wet: 0.55, rain: 0.45 },
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

export function estimateTopSpeedKph(
  curves: EngineCurves,
  vehicle: VehicleSpec,
  headwindMs: number,
): number {
  const topGearRatio = vehicle.gearRatios[vehicle.gearRatios.length - 1];
  const rollingForce = vehicle.rollingResistanceCoefficient * vehicle.weightKg * G;

  // Torque vs RPM isn't monotonic (it rises, peaks, then tapers), so in a
  // fixed, tall top gear the drive-force-minus-resistance margin can dip
  // negative at a low speed (weak low-RPM torque) and then recover once RPM
  // climbs into the engine's strong torque band. Breaking on the first
  // negative margin would understate top speed by stopping at that early
  // dip - scan the full range and keep the highest speed that ever balances,
  // only stopping once the redline itself becomes the limiter.
  let lastValidSpeedMs = 0;
  const stepMs = 0.2;
  for (let speedMs = stepMs; speedMs < 130; speedMs += stepMs) {
    const rpm = rpmFromSpeed(speedMs, topGearRatio, vehicle);
    if (rpm > curves.maxRevRpm) break;

    const torqueNm = curves.torqueAt(rpm);
    const driveForce =
      (torqueNm * topGearRatio * vehicle.finalDrive * vehicle.drivetrainEfficiency) /
      vehicle.wheelRadiusM;
    const relativeSpeedMs = speedMs + headwindMs;
    const dragForce =
      0.5 *
      AIR_DENSITY_KG_M3 *
      vehicle.dragCoefficient *
      vehicle.frontalAreaM2 *
      relativeSpeedMs *
      relativeSpeedMs;

    if (driveForce > dragForce + rollingForce) {
      lastValidSpeedMs = speedMs;
    }
  }

  return lastValidSpeedMs * 3.6;
}
