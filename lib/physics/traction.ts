import { normalLoadN } from "./aeroModel";
import { VehicleSpec } from "./types";
import { G } from "./vehicleDynamics";

// Total tyre load (static weight +/- aero) split between the axles by the
// static weight distribution. Aero load is split the same way - a
// simplification, since real aero balance is tuned separately.
export function axleLoadsN(speedMs: number, vehicle: VehicleSpec): { frontN: number; rearN: number } {
  const totalN = normalLoadN(speedMs, vehicle, G);
  const rearN = totalN * vehicle.rearWeightFraction;
  return { frontN: totalN - rearN, rearN };
}

// Traction limit of the driven wheels, F_max = mu * N_driven, including
// longitudinal weight transfer under acceleration:
//
//   N_rear  = m g (b/L) + m a (h/L)
//   N_front = m g (a'/L) - m a (h/L)
//
// so rear-wheel drive gains grip as it accelerates and front-wheel drive
// loses it; all-wheel drive uses the whole car's weight either way. At the
// traction limit the car's acceleration is a = (F - R) / m, which itself
// sets the transfer, so the limit is solved in closed form rather than
// lagging a step behind:
//
//   RWD: F = mu (N_r0 - h R / L) / (1 - mu h / L)
//   FWD: F = mu (N_f0 + h R / L) / (1 + mu h / L)
export function tractionLimitN(
  speedMs: number,
  vehicle: VehicleSpec,
  mu: number,
  resistanceN: number,
): number {
  const { frontN, rearN } = axleLoadsN(speedMs, vehicle);
  if (vehicle.drivetrain === "awd") return mu * (frontN + rearN);

  const hOverL = vehicle.cgHeightM / vehicle.wheelbaseM;
  const q = mu * hOverL;
  if (vehicle.drivetrain === "rwd") {
    // q >= 1 would mean the car could lift its front wheels - keep the
    // denominator sane instead of letting the limit run off to infinity.
    return Math.max(0, (mu * (rearN - hOverL * resistanceN)) / Math.max(0.2, 1 - q));
  }
  return Math.max(0, (mu * (frontN + hOverL * resistanceN)) / (1 + q));
}

// Engine force at the wheels as the tyres actually feel it, once the engine
// has also spun up everything that rotates with it (a = F / (m k), see
// rotatingInertiaFactor): comparing this against the traction limit, and
// accelerating the car with a = (F - R) / m, is the same as taking the
// smaller of the engine-limited a = (F_wheel - R) / (m k) and the
// traction-limited a = (F_max - R) / m. When the tyres are the limit the
// engine has torque to spare for its own inertia, so k no longer slows
// the car.
export function effectiveDriveForceN(engineForceN: number, resistanceN: number, inertiaFactor: number): number {
  return resistanceN + (engineForceN - resistanceN) / inertiaFactor;
}

// Without traction control, once the tyres break loose the car is on
// kinetic friction (lower than static) until grip is regained, instead of
// the smooth, modulated cap traction control provides.
export const UNCONTROLLED_SLIP_PENALTY = 0.75;

export function deliveredDriveForceN(demandN: number, limitN: number, tractionControl: boolean): number {
  if (demandN <= limitN) return demandN;
  return tractionControl ? limitN : limitN * UNCONTROLLED_SLIP_PENALTY;
}

// Slip ratio (%) of the driven wheels. A tyre needs some slip to make any
// force at all - roughly linear up to its peak at ~10% slip - so below the
// traction limit slip scales with how much of the grip is in use. Past the
// limit, traction control holds the tyre at that optimum; without it, the
// excess torque just spins the wheels up, and at twice the grip they're
// effectively spinning freely.
const OPTIMAL_SLIP_PERCENT = 10;

export function wheelSpinPercent(demandN: number, limitN: number, tractionControl: boolean): number {
  if (limitN <= 0) return demandN > 0 ? 100 : 0;
  const ratio = demandN / limitN;
  if (ratio <= 1) return OPTIMAL_SLIP_PERCENT * Math.max(0, ratio);
  if (tractionControl) return OPTIMAL_SLIP_PERCENT;
  return OPTIMAL_SLIP_PERCENT + (100 - OPTIMAL_SLIP_PERCENT) * Math.min(1, ratio - 1);
}
