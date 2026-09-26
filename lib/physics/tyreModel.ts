import { ChassisConfig, RoadCondition, VehicleSpec } from "./types";
import { tyreGripMultiplier } from "./vehicleDynamics";

// A simplified (non-Pacejka) tyre model: longitudinal and lateral grip are
// tracked as two separate coefficients rather than one scalar "grip" value,
// so they can be combined through a friction ellipse (see
// combinedLongCapacityN below) instead of independently maxed out at the
// same time. Both start from the same base coefficient - built up in
// vehicleModel.ts/vehicleDynamics.ts from tyre width, pressure, compound,
// type and road condition - because no per-axis (long vs. lateral) tyre
// test data exists for these synthetic tyres to justify giving them
// different peaks. How much of the longitudinal grip the *driven* wheels
// can use also depends on weight transfer - see traction.ts.
export interface TyreLimits {
  muLong: number;
  muLat: number;
}

export function computeTyreLimits(
  vehicle: VehicleSpec,
  chassis: ChassisConfig,
  condition: RoadCondition,
): TyreLimits {
  const muBase =
    vehicle.tireGripMu * tyreGripMultiplier(chassis.tyreType, chassis.tyreCompound, condition);
  return {
    muLong: muBase,
    muLat: muBase,
  };
}

// Braking is modeled as an idealized max-effort ABS stop (see
// brakeModel.ts) on all four tyres, using the raw peak longitudinal
// coefficient.
export function brakingMuLong(vehicle: VehicleSpec, chassis: ChassisConfig, condition: RoadCondition): number {
  return vehicle.tireGripMu * tyreGripMultiplier(chassis.tyreType, chassis.tyreCompound, condition);
}

// Friction-circle/ellipse constraint: (Fx/FxMax)^2 + (Fy/FyMax)^2 <= 1. Given
// a lateral force already being demanded by the corner the car is in, this
// returns how much longitudinal (accel or brake) force capacity is left
// over - the tyre cannot spend its whole grip budget on cornering and still
// have the full amount left for braking or driving.
export function combinedLongCapacityN(
  lateralForceN: number,
  lateralMaxN: number,
  longitudinalMaxN: number,
): number {
  if (lateralMaxN <= 0) return 0;
  const usedFraction = Math.min(1, Math.abs(lateralForceN) / lateralMaxN);
  return longitudinalMaxN * Math.sqrt(Math.max(0, 1 - usedFraction * usedFraction));
}
