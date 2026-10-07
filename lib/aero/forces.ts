import { AIR_DENSITY_KG_M3, G } from "../physics/vehicleDynamics";
import { AeroMode } from "../physics/types";
import { VehicleState } from "../physics/vehicleState";

// The basic aerodynamic force model: every force is the dynamic pressure
// q = 1/2 rho V^2 times a coefficient times the frontal area,
//
//   drag      D = q Cd A
//   downforce L = q Cl A      (Cl > 0 presses the car down; < 0 is lift)
//
// and the power spent pushing the car through the air is P = D V. These are
// the same relationships, coefficients and air density the simulation uses
// (lib/physics/aeroModel.ts - scripts/aero-check.ts asserts they agree), so
// a figure here is exactly what the drag and lap simulations feel at that
// speed in still air.
//
// What it assumes: coefficients that don't change with speed, ride height
// or yaw; still air (no wind); and Cd/Cl that are representative figures
// for the body type (lib/physics/defaults.ts), not measured data for any
// one car. There is no front/rear split of the downforce in the data, so no
// aero balance either.

// ISA sea level, 15 degC - the simulation's fixed value.
export const AIR_DENSITY = AIR_DENSITY_KG_M3;

export interface AeroCoefficients {
  dragCoefficient: number;
  // Positive = downforce, negative = lift.
  liftCoefficient: number;
  frontalAreaM2: number;
}

export interface AeroForces {
  speedKph: number;
  speedMs: number;
  airDensityKgM3: number;
  dynamicPressurePa: number;
  dragN: number;
  // Positive = downforce, negative = lift.
  downforceN: number;
  // Power to overcome drag at this speed (not including rolling resistance
  // or drivetrain losses).
  dragPowerKw: number;
}

export function aeroCoefficients(vehicle: VehicleState, mode: AeroMode = "corner"): AeroCoefficients {
  const { aero } = vehicle;
  const straight = mode === "straight" && aero.activeAero;
  return {
    dragCoefficient: straight ? aero.activeAero!.dragCoefficientStraight : aero.dragCoefficient,
    liftCoefficient: straight ? aero.activeAero!.liftCoefficientStraight : aero.liftCoefficient,
    frontalAreaM2: aero.frontalAreaM2,
  };
}

export function dynamicPressurePa(speedMs: number, airDensityKgM3 = AIR_DENSITY): number {
  return 0.5 * airDensityKgM3 * speedMs * speedMs;
}

export function aeroForcesAt(c: AeroCoefficients, speedKph: number, airDensityKgM3 = AIR_DENSITY): AeroForces {
  const speedMs = speedKph / 3.6;
  const q = dynamicPressurePa(speedMs, airDensityKgM3);
  const dragN = q * c.dragCoefficient * c.frontalAreaM2;
  return {
    speedKph,
    speedMs,
    airDensityKgM3,
    dynamicPressurePa: q,
    dragN,
    downforceN: q * c.liftCoefficient * c.frontalAreaM2,
    dragPowerKw: (dragN * speedMs) / 1000,
  };
}

// Downforce as a fraction of the car's weight (negative for lift).
export function downforceToWeight(forces: AeroForces, massKg: number): number {
  return forces.downforceN / (massKg * G);
}

// The speed (km/h) at which downforce equals the car's weight - the
// textbook "could drive upside down" figure. Null for a car that makes
// lift, or no downforce at all.
export function speedForDownforceEqualWeightKph(c: AeroCoefficients, massKg: number, airDensityKgM3 = AIR_DENSITY): number | null {
  const clA = c.liftCoefficient * c.frontalAreaM2;
  if (clA <= 0) return null;
  return Math.sqrt((massKg * G) / (0.5 * airDensityKgM3 * clA)) * 3.6;
}
