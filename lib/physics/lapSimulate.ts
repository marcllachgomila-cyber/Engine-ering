import { BRAKE_AMBIENT_TEMP_C, BRAKE_MATERIALS, brakeCoolingRatePerS } from "./brakeModel";
import { DriverInputPoint, deriveDriverInputs } from "./driverModel";
import { buildEngineCurves } from "./engineModel";
import { LongitudinalModel, SpeedProfilePoint, buildLongitudinalModel, computeSpeedProfile } from "./speedProfile";
import { computeWeightBreakdown, deriveVehicle } from "./vehicleModel";
import {
  Circuit,
  ChassisConfig,
  EngineConfig,
  EngineCurves,
  GearboxConfig,
  SimulationResult,
  Telemetry,
  TestConfig,
  VehicleSpec,
} from "./types";
import { G, estimateTopSpeedKph } from "./vehicleDynamics";

// Below this speed, a distance-domain dt = ds / v integration blows up
// numerically. A hot lap's speed profile should never actually get this
// low (see UNCONSTRAINED_SPEED_MS/cornering-limit floor in
// speedProfile.ts) - this only guards against pathological configurations
// (e.g. near-zero grip) so the simulation stays finite instead of
// producing Infinity/NaN lap times.
const MIN_INTEGRATION_SPEED_MS = 0.3;

// Bisection steps when searching for the deployment cutoff speed that uses
// exactly the lap's electrical energy budget - 20 halvings of a ~100m/s
// range pins it to 0.1mm/s, far past mattering.
const DEPLOY_CUTOFF_BISECTION_STEPS = 20;

export interface HotLapSolution {
  curves: EngineCurves;
  vehicle: VehicleSpec;
  model: LongitudinalModel;
  profile: SpeedProfilePoint[];
  inputs: DriverInputPoint[];
  // Speed above which the electric motor stops deploying (Infinity when
  // the energy limit never bites), and the energy it deploys over the lap.
  electricCutoffMs: number;
  electricDeployedMj: number;
}

// The speed profile and driver inputs for one lap, within the power unit's
// per-lap electrical energy limit (engine.hybridDeployMjPerLap) if it has
// one. When flat-out deployment would need more than that, the car deploys
// the motor only below a cutoff speed and runs on the combustion engine
// alone above it - what real hybrid F1 cars do ("clipping" at the end of
// the straights), and close to the best use of the energy, since a joule
// spent accelerating out of a slow corner buys more time than one spent at
// 300km/h. The cutoff is whatever speed spends exactly the budget.
export function solveHotLap(
  engine: EngineConfig,
  chassis: ChassisConfig,
  gearbox: GearboxConfig,
  test: TestConfig,
  circuit: Circuit,
): HotLapSolution {
  const curves = buildEngineCurves(engine);
  const vehicle = deriveVehicle(engine, curves, chassis, gearbox);

  const solveWithCutoff = (electricCutoffMs: number): HotLapSolution => {
    const model = buildLongitudinalModel(vehicle, chassis, curves, test, electricCutoffMs);
    const profile = computeSpeedProfile(circuit.points, vehicle, model, test.lapStartMode);
    const inputs = deriveDriverInputs(profile, vehicle, curves, model);
    const ds = profile.length > 1 ? profile[1].distanceM - profile[0].distanceM : 0;
    let deployedJ = 0;
    for (let i = 0; i < profile.length; i++) {
      deployedJ += (inputs[i].electricPowerW * ds) / Math.max(MIN_INTEGRATION_SPEED_MS, profile[i].speedMs);
    }
    return { curves, vehicle, model, profile, inputs, electricCutoffMs, electricDeployedMj: deployedJ / 1e6 };
  };

  const unlimited = solveWithCutoff(Infinity);
  const budgetMj = engine.hybridDeployMjPerLap;
  if (budgetMj === undefined || unlimited.electricDeployedMj <= budgetMj) return unlimited;

  // Deployed energy only grows as the cutoff rises, so bisect on it.
  let low = 0;
  let high = Math.max(...unlimited.profile.map((p) => p.speedMs));
  let best = solveWithCutoff(low);
  for (let k = 0; k < DEPLOY_CUTOFF_BISECTION_STEPS; k++) {
    const mid = (low + high) / 2;
    const attempt = solveWithCutoff(mid);
    if (attempt.electricDeployedMj <= budgetMj) {
      low = mid;
      best = attempt;
    } else {
      high = mid;
    }
  }
  return best;
}

// One theoretical flying lap of a circuit, calculated (not guessed) end to
// end:
//
//   vehicle config -> engine/gearbox -> wheel force -> tyre limits
//   -> aerodynamics -> braking/acceleration -> circuit curvature
//   -> virtual driver -> speed profile -> telemetry -> lap time
//
// circuit.points already carries distance/heading/curvature derived purely
// from the track's geometry (circuitGeometry.ts); this function's job is to
// find the fastest speed the car can carry at every one of those points
// (computeSpeedProfile), turn that into per-point pedal/gear inputs
// (deriveDriverInputs), and integrate dt = ds / v along the lap to get both
// the telemetry trace and the final lap time - never the other way around.
export function simulateHotLap(
  engine: EngineConfig,
  chassis: ChassisConfig,
  gearbox: GearboxConfig,
  test: TestConfig,
  circuit: Circuit,
): SimulationResult {
  const { curves, vehicle, profile, inputs } = solveHotLap(engine, chassis, gearbox, test, circuit);

  const n = profile.length;
  const ds = n > 1 ? profile[1].distanceM - profile[0].distanceM : circuit.lengthM;

  let t = 0;
  let brakeTempC = test.initialBrakeTempC;
  const brakeMaterial = BRAKE_MATERIALS[test.brakeMaterial];
  let prevGear = inputs[0]?.gear ?? 1;

  const telemetry: Telemetry[] = [];
  let peakWheelSpinPercent = 0;

  for (let i = 0; i < n; i++) {
    const point = profile[i];
    const input = inputs[i];

    // Each gear change (vehicle.shiftTimeS, see vehicleModel.ts) is added
    // as dead time on the lap clock rather than modeled inside the
    // speed-position solve, which works in distance, not time, and doesn't
    // need discrete events to find the fastest achievable speed at each
    // point.
    if (input.gear !== prevGear) {
      t += vehicle.shiftTimeS;
      prevGear = input.gear;
    }

    // A standing start begins the lap at rest, so holding this point's own
    // speed constant across the segment (the usual approximation, fine when
    // consecutive points are close in speed) would wildly overstate the
    // time for that first, near-zero-speed segment. Use the segment's
    // average speed instead - exact for the constant-acceleration launch
    // the speed profile itself already assumes.
    const integrationSpeedMs =
      i === 0 && test.lapStartMode === "standing" && n > 1
        ? Math.max(MIN_INTEGRATION_SPEED_MS, (point.speedMs + profile[1].speedMs) / 2)
        : Math.max(MIN_INTEGRATION_SPEED_MS, point.speedMs);
    const dt = ds / integrationSpeedMs;
    t += dt;

    // Air cooling relaxes the brakes toward ambient every step - faster at
    // speed on a straight, slower through a slow corner - then any heat
    // generated by braking this step piles back on top.
    const coolingRatePerS = brakeCoolingRatePerS(point.speedMs);
    brakeTempC = BRAKE_AMBIENT_TEMP_C + (brakeTempC - BRAKE_AMBIENT_TEMP_C) * Math.exp(-coolingRatePerS * dt);
    if (input.brakeForceN > 0) {
      brakeTempC += (input.brakeForceN * ds) / brakeMaterial.thermalMassJPerC;
    }

    peakWheelSpinPercent = Math.max(peakWheelSpinPercent, input.wheelSpinPercent);
    telemetry.push({
      t,
      speedKph: point.speedMs * 3.6,
      rpm: input.rpm,
      gear: input.gear,
      // What the power unit can give here: the combustion engine plus the
      // motor, unless it's clipped above the deployment cutoff.
      hp: (input.torqueNm * input.rpm * ((2 * Math.PI) / 60)) / 745.7,
      torqueNm: input.torqueNm,
      gForce: input.accelMs2 / G,
      distanceM: point.distanceM,
      brakeTempC,
      brakeForceN: input.brakeForceN,
      lateralGForce: (point.speedMs * point.speedMs * point.curvature) / G,
      throttle: input.throttle,
      brakeInput: input.brakeInput,
      tyreUtilization: input.tyreUtilization,
      wheelSpinPercent: input.wheelSpinPercent,
      downforceN: input.downforceN,
      dragN: input.dragN,
      curvature: point.curvature,
    });
  }

  const last = telemetry[telemetry.length - 1] ?? null;

  return {
    telemetry,
    testType: "hotLap",
    initialSpeedKph: profile[0]?.speedMs !== undefined ? profile[0].speedMs * 3.6 : 0,
    elapsedS: t,
    finalSpeedKph: last?.speedKph ?? 0,
    finalDistanceM: circuit.lengthM,
    reachedHundredAtS: null,
    timedOut: false,
    peakHp: curves.peakPowerHp,
    peakHpRpm: curves.peakPowerRpm,
    peakTorqueNm: curves.peakTorqueNm,
    peakTorqueRpm: curves.peakTorqueRpm,
    weightKg: vehicle.weightKg,
    weightBreakdown: computeWeightBreakdown(engine, chassis, gearbox).components,
    powerToWeightHpPerTonne: curves.peakPowerHp / (vehicle.weightKg / 1000),
    theoreticalTopSpeedKph: estimateTopSpeedKph(curves, vehicle, 0),
    peakWheelSpinPercent,
    circuitId: circuit.id,
  };
}
