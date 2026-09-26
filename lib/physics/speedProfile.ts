import { BRAKE_MATERIALS, ABS_OFF_PENALTY } from "./brakeModel";
import { aeroModeVehicle, downforceN, dragForceN, normalLoadN } from "./aeroModel";
import { deliveredDriveForceN, effectiveDriveForceN, tractionLimitN } from "./traction";
import { brakingMuLong, combinedLongCapacityN, computeTyreLimits } from "./tyreModel";
import {
  AeroMode,
  ChassisConfig,
  CircuitPoint,
  EngineCurves,
  ErsConfig,
  LapStartMode,
  TestConfig,
  VehicleSpec,
} from "./types";
import {
  AIR_DENSITY_KG_M3,
  G,
  conditionHeadwindMs,
  gearForAcceleration,
  rotatingInertiaFactor,
  rpmFromSpeed,
  wheelForceN,
} from "./vehicleDynamics";

// A generous ceiling on any single corner's speed limit, used only when a
// point's curvature is close enough to zero that the corner-speed formula
// would otherwise blow up toward infinity (i.e. "this point does not
// meaningfully constrain speed" - the car's real limit there is drag/power,
// enforced separately by the accel/brake passes).
const UNCONSTRAINED_SPEED_MS = 170;

// How many forward+backward sweeps to run before treating the profile as
// converged. The initial guess (each point's own corner-speed limit) is
// already close to the true answer, so a handful of passes is enough for a
// closed lap - see the "iterate where necessary" note in the project brief.
const CONVERGENCE_PASSES = 4;

export interface SpeedProfilePoint extends CircuitPoint {
  speedMs: number;
}

export interface DriveState {
  gear: number;
  rpm: number;
  torqueNm: number;
  // The part of torqueNm coming from the electric motor.
  electricTorqueNm: number;
  engineForceN: number;
}

// `electricFactor` (0-1): how much of the electric motor's torque is being
// deployed - less than all of it when the battery is running dry or the
// rules taper it off at high speed (see lapSimulate.ts).
export function computeDrive(
  speedMs: number,
  vehicle: VehicleSpec,
  curves: EngineCurves,
  electricFactor = 1,
): DriveState {
  const gear = gearForAcceleration(speedMs, vehicle);
  const gearRatio = vehicle.gearRatios[gear - 1];
  const rpm = Math.min(
    Math.max(rpmFromSpeed(speedMs, gearRatio, vehicle), curves.idleRpm),
    curves.maxRevRpm,
  );
  const electricTorqueNm = curves.electricTorqueAt(rpm) * electricFactor;
  const torqueNm = curves.torqueAt(rpm) - curves.electricTorqueAt(rpm) + electricTorqueNm;
  const engineForceN = wheelForceN(torqueNm, gearRatio, vehicle);
  return { gear, rpm, torqueNm, electricTorqueNm, engineForceN };
}

export interface LongitudinalModel {
  muLong: number;
  muLat: number;
  headwindMs: number;
  rollingForceN: number;
  tractionControl: boolean;
  // The motor torque factor for computeDrive at this speed, given how much
  // of the motor the battery can feed (0-1, cut back further by the
  // rules' high-speed deployment taper, see ErsConfig) - or, when negative,
  // how hard the motor is harvesting on throttle instead (not tapered).
  electricFactor: (speedMs: number, electricAvailability: number) => number;
  // The car in each active-aero mode (the same object for both when it
  // has none) - see aeroModeVehicle.
  aeroVehicle: (mode: AeroMode) => VehicleSpec;
  lateralDemandN: (speedMs: number, curvature: number) => number;
  driveTractionLimitN: (speedMs: number, curvature: number, mode?: AeroMode) => number;
  // `electricAvailability` (-1 to 1): see electricFactor.
  availableDriveForceN: (
    speedMs: number,
    curvature: number,
    mode?: AeroMode,
    electricAvailability?: number,
  ) => number;
  availableBrakeForceN: (speedMs: number, curvature: number) => number;
  maxAccelMs2: (speedMs: number, curvature: number, mode?: AeroMode, electricAvailability?: number) => number;
  maxBrakeDecelMs2: (speedMs: number, curvature: number) => number;
}

// Everything needed to answer "how hard can this car accelerate or brake
// right here?" - built once per simulation and shared between the
// speed-profile solver and the telemetry/driver-input pass afterward, so
// both stages agree exactly on what the car is capable of at any given
// point.
//
// Acceleration and cornering take the point's active-aero mode. Braking
// doesn't: the wings snap back to corner mode the moment the driver brakes
// (see lapSimulate.ts), so every braking force here is corner-mode by
// definition - the backward pass never has to know which mode a point was
// in before the braking zone began.
export function buildLongitudinalModel(
  vehicle: VehicleSpec,
  chassis: ChassisConfig,
  curves: EngineCurves,
  test: TestConfig,
  ers?: ErsConfig,
): LongitudinalModel {
  const { muLong, muLat } = computeTyreLimits(vehicle, chassis, test.condition);
  const headwindMs = conditionHeadwindMs(test.condition);
  const rollingForceN = vehicle.rollingResistanceCoefficient * vehicle.weightKg * G;
  const straightVehicle = aeroModeVehicle(vehicle, "straight");
  const aeroVehicle = (mode: AeroMode): VehicleSpec => (mode === "straight" ? straightVehicle : vehicle);

  const electricTaper = (speedMs: number): number => {
    if (!ers) return 1;
    const kph = speedMs * 3.6;
    const span = ers.deployTaperEndKph - ers.deployTaperStartKph;
    if (span <= 0) return kph < ers.deployTaperEndKph ? 1 : 0;
    return Math.min(1, Math.max(0, (ers.deployTaperEndKph - kph) / span));
  };
  const electricFactor = (speedMs: number, electricAvailability: number): number =>
    electricAvailability < 0 ? electricAvailability : electricAvailability * electricTaper(speedMs);

  // Brake effectiveness is evaluated once, at the configured starting brake
  // temperature, and held fixed for the purpose of finding the
  // physically-achievable speed profile - a hot lap assumes brakes already
  // at working temperature, and fully coupling brake fade into this
  // iterative solve would require re-solving the whole lap every time the
  // temperature estimate changed. Telemetry (lapSimulate.ts) still lets
  // brake temperature evolve dynamically once the profile is fixed, so the
  // temperature trace itself stays dynamic.
  const brakeMaterial = BRAKE_MATERIALS[test.brakeMaterial];
  const brakeEffectiveness =
    brakeMaterial.effectivenessAt(test.initialBrakeTempC) * (test.absEnabled ? 1 : ABS_OFF_PENALTY);
  const brakingMuLongValue = brakingMuLong(vehicle, chassis, test.condition) * brakeEffectiveness;

  const lateralDemandN = (speedMs: number, curvature: number): number =>
    vehicle.weightKg * speedMs * speedMs * Math.abs(curvature);

  // The driven axle's traction limit (with weight transfer), after the
  // friction ellipse claims whatever the current cornering demand needs
  // first.
  const driveTractionLimitN = (speedMs: number, curvature: number, mode: AeroMode = "corner"): number => {
    const aero = aeroVehicle(mode);
    const normalLoad = normalLoadN(speedMs, aero, G);
    const fyMax = muLat * normalLoad;
    const resistanceN = dragForceN(speedMs + headwindMs, aero) + rollingForceN;
    const fxMaxTyre = tractionLimitN(speedMs, aero, muLong, resistanceN);
    return combinedLongCapacityN(lateralDemandN(speedMs, curvature), fyMax, fxMaxTyre);
  };

  // Longitudinal tyre force actually deliverable at this speed, net of
  // spinning up the drivetrain's rotating inertia (see traction.ts).
  const availableDriveForceN = (
    speedMs: number,
    curvature: number,
    mode: AeroMode = "corner",
    electricAvailability = 1,
  ): number => {
    const drive = computeDrive(speedMs, vehicle, curves, electricFactor(speedMs, electricAvailability));
    const resistanceN = dragForceN(speedMs + headwindMs, aeroVehicle(mode)) + rollingForceN;
    return deliveredDriveForceN(
      effectiveDriveForceN(drive.engineForceN, resistanceN, rotatingInertiaFactor(vehicle, drive.gear)),
      driveTractionLimitN(speedMs, curvature, mode),
      chassis.tractionControl,
    );
  };

  // Combined tyre+brake force deliverable at this speed, same friction-
  // ellipse treatment, using the braking-specific (non-wheelspin-derated)
  // longitudinal coefficient and the configured brake material/ABS.
  const availableBrakeForceN = (speedMs: number, curvature: number): number => {
    const normalLoad = normalLoadN(speedMs, vehicle, G);
    const fyMax = muLat * normalLoad;
    const fxMaxBrake = brakingMuLongValue * normalLoad;
    return combinedLongCapacityN(lateralDemandN(speedMs, curvature), fyMax, fxMaxBrake);
  };

  const maxAccelMs2 = (
    speedMs: number,
    curvature: number,
    mode: AeroMode = "corner",
    electricAvailability = 1,
  ): number => {
    const drag = dragForceN(speedMs + headwindMs, aeroVehicle(mode));
    return (
      (availableDriveForceN(speedMs, curvature, mode, electricAvailability) - drag - rollingForceN) /
      vehicle.weightKg
    );
  };

  const maxBrakeDecelMs2 = (speedMs: number, curvature: number): number => {
    const drive = computeDrive(speedMs, vehicle, curves);
    const engineBrakingForceN =
      (curves.frictionTorqueAt(drive.rpm) *
        vehicle.gearRatios[drive.gear - 1] *
        vehicle.finalDrive *
        vehicle.drivetrainEfficiency) /
      vehicle.wheelRadiusM;
    const drag = dragForceN(speedMs + headwindMs, vehicle);
    return (availableBrakeForceN(speedMs, curvature) + drag + rollingForceN + engineBrakingForceN) / vehicle.weightKg;
  };

  return {
    muLong,
    muLat,
    headwindMs,
    rollingForceN,
    tractionControl: chassis.tractionControl,
    electricFactor,
    aeroVehicle,
    lateralDemandN,
    driveTractionLimitN,
    availableDriveForceN,
    availableBrakeForceN,
    maxAccelMs2,
    maxBrakeDecelMs2,
  };
}

// The fastest speed the tyres can physically hold this curvature at,
// derived from the lateral friction limit alone (Fy = m v^2 k <= muLat *
// normalLoad(v)). Downforce grows the right-hand side with speed, which is
// exactly why more downforce raises high-speed cornering limits without
// this formula having to say so explicitly - it falls out of solving for v.
export function cornerSpeedLimitMs(curvature: number, muLat: number, vehicle: VehicleSpec): number {
  const k = Math.abs(curvature);
  if (k < 1e-5) return UNCONSTRAINED_SPEED_MS;

  const m = vehicle.weightKg;
  const aeroTermPerV2 = muLat * 0.5 * AIR_DENSITY_KG_M3 * vehicle.liftCoefficient * vehicle.frontalAreaM2;
  const denom = m * k - aeroTermPerV2;
  if (denom <= 1e-6) return UNCONSTRAINED_SPEED_MS;

  const vSquared = (muLat * m * G) / denom;
  return Math.min(UNCONSTRAINED_SPEED_MS, Math.sqrt(Math.max(0, vSquared)));
}

// Builds the physically-constrained speed profile for one lap: each point's
// pure cornering limit, then repeated forward (traction-limited
// acceleration) and backward (friction-limited braking) sweeps so no point
// ever demands a speed the car couldn't actually have reached or couldn't
// still shed in time for what's ahead. This *is* the look-ahead driver - the
// backward sweep is what forces braking to start before a corner rather
// than the corner entrance whenever one pass isn't enough distance.
//
// `aeroModes` (one per point, all corner mode if omitted) sets each
// point's active-aero mode for its cornering limit and the forward sweep;
// the backward sweep is braking, which is always corner mode.
// `electricAvailability` (one per point, all 1 if omitted) is how much of
// the electric motor the battery can feed there, for the forward sweep.
export function computeSpeedProfile(
  points: CircuitPoint[],
  vehicle: VehicleSpec,
  model: LongitudinalModel,
  startMode: LapStartMode = "flying",
  aeroModes?: AeroMode[],
  electricAvailability?: number[],
): SpeedProfilePoint[] {
  const n = points.length;
  const ds = n > 1 ? points[1].distanceM - points[0].distanceM : 0;
  const standingStart = startMode === "standing";

  const modeAt = (i: number): AeroMode => aeroModes?.[i] ?? "corner";
  const speedMs = points.map((p, i) => cornerSpeedLimitMs(p.curvature, model.muLat, model.aeroVehicle(modeAt(i))));
  // A standing start begins from a dead stop on the line rather than
  // whatever speed the corner before it would otherwise allow.
  if (standingStart) speedMs[0] = 0;

  for (let pass = 0; pass < CONVERGENCE_PASSES; pass++) {
    // Forward sweep: how fast could the car be going here, given how fast
    // it was going ds behind and the most it could have accelerated since?
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const a = model.maxAccelMs2(speedMs[i], points[i].curvature, modeAt(i), electricAvailability?.[i] ?? 1);
      const reachable = Math.sqrt(Math.max(0, speedMs[i] * speedMs[i] + 2 * a * ds));
      speedMs[next] = Math.min(speedMs[next], reachable);
    }
    // Backward sweep: how fast can the car afford to be going here, given
    // it must be able to brake down to the speed required ds ahead? This is
    // the look-ahead braking point - it naturally pushes braking earlier
    // than the corner entrance whenever one pass isn't enough distance.
    for (let i = n - 1; i >= 0; i--) {
      // On a standing start there's no next lap to brake for by the line -
      // skip the wrap-around edge so the final sector's exit speed isn't
      // wrongly capped by needing to slow to a stop at the start/finish.
      if (standingStart && i === n - 1) continue;
      const next = (i + 1) % n;
      const a = model.maxBrakeDecelMs2(speedMs[next], points[next].curvature);
      const reachable = Math.sqrt(Math.max(0, speedMs[next] * speedMs[next] + 2 * a * ds));
      speedMs[i] = Math.min(speedMs[i], reachable);
    }
  }

  return points.map((p, i) => ({ ...p, speedMs: speedMs[i] }));
}

// Fraction of the friction circle/ellipse currently in use, for telemetry:
// sqrt((Fx/FxMax)^2 + (Fy/FyMax)^2), clamped just above 1 to allow for
// floating-point slop right at the limit rather than visually reading as
// "over the limit" when the solver is exactly on it.
export function tyreUtilizationAt(
  speedMs: number,
  curvature: number,
  longitudinalForceN: number,
  vehicle: VehicleSpec,
  muLong: number,
  muLat: number,
): number {
  const normalLoad = normalLoadN(speedMs, vehicle, G);
  const fyMax = muLat * normalLoad;
  const fxMax = muLong * normalLoad;
  const fy = vehicle.weightKg * speedMs * speedMs * Math.abs(curvature);
  const ratio = Math.sqrt((longitudinalForceN / Math.max(1, fxMax)) ** 2 + (fy / Math.max(1, fyMax)) ** 2);
  return Math.min(1.05, ratio);
}

export { downforceN as computeDownforceN };
